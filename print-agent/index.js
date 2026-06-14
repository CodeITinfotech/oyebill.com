/**
 * Oyebill Print Agent
 * Local Windows service that receives print jobs and sends to ESC/POS printers
 * 
 * Usage:
 *   npm install
 *   npm start
 * 
 * The agent listens on localhost:8181 and accepts print requests
 */

const express = require('express');
const cors = require('cors');
const escpos = require('escpos');

// Load USB adapter if available
try {
  escpos.USB = require('escpos-usb');
} catch (e) {
  console.log('USB adapter not available:', e.message);
}

// Load Network adapter for network printers
try {
  escpos.Network = require('escpos-network');
} catch (e) {
  console.log('Network adapter not available:', e.message);
}

const app = express();
app.use(cors());
app.use(express.json());

// Store connected devices
let printerDevice = null;
let currentPrinter = null;

// Auto-detect USB printers
function detectUSBPrinters() {
  if (!escpos.USB) return [];
  try {
    const devices = escpos.USB.list();
    return devices.map(d => ({
      id: d.deviceName,
      name: d.deviceName,
      type: 'USB'
    }));
  } catch (e) {
    console.log('USB detection error:', e.message);
    return [];
  }
}

// Connect to printer
async function connectPrinter(printerConfig) {
  try {
    // Close existing connection
    if (printerDevice) {
      try { printerDevice.close(); } catch (e) {}
    }

    let device;

    if (printerConfig.type === 'USB') {
      if (!escpos.USB) {
        throw new Error('USB support not available');
      }
      const devices = escpos.USB.list();
      if (devices.length === 0) {
        throw new Error('No USB printers found');
      }
      // Use first USB printer or specified device
      device = new escpos.USB(devices[0].deviceId);
    } else if (printerConfig.type === 'Network') {
      if (!escpos.Network) {
        throw new Error('Network support not available');
      }
      device = new escpos.Network(printerConfig.ip, printerConfig.port || 9100);
    } else {
      throw new Error('Unknown printer type: ' + printerConfig.type);
    }

    // Wait for connection
    await new Promise((resolve, reject) => {
      device.open((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    printerDevice = device;
    currentPrinter = new escpos.Printer(device);
    
    return { success: true, printer: printerConfig };
  } catch (error) {
    console.error('Connection error:', error.message);
    throw error;
  }
}

// Print receipt
async function printReceipt(receipt, options = {}) {
  if (!currentPrinter || !printerDevice) {
    throw new Error('No printer connected');
  }

  return new Promise((resolve, reject) => {
    const printer = currentPrinter;
    
    printer
      .align('center')
      .style('normal')
      .size(1, 1)
      .text(receipt)
      .cut()
      .close((err) => {
        if (err) reject(err);
        else resolve();
      });
  });
}

// Print KOT (Kitchen Order Ticket)
async function printKOT(kotData, options = {}) {
  if (!currentPrinter || !printerDevice) {
    throw new Error('No printer connected');
  }

  return new Promise((resolve, reject) => {
    const printer = currentPrinter;
    
    printer
      .align('center')
      .style('bold')
      .size(1, 1)
      .text('========== KOT ==========')
      .text(`Table: ${kotData.table || 'N/A'}`)
      .text(`Order: ${kotData.orderId || 'N/A'}`)
      .text(`Time: ${kotData.time || new Date().toLocaleTimeString()}`)
      .text('========================')
      .align('left')
      .style('normal')
      .text('--------------------------------')
      .text(kotData.items || '')
      .text('--------------------------------')
      .cut()
      .close((err) => {
        if (err) reject(err);
        else resolve();
      });
  });
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    printer: currentPrinter ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Get available printers
app.get('/printers', (req, res) => {
  try {
    const printers = detectUSBPrinters();
    res.json({ 
      success: true, 
      printers,
      connected: currentPrinter ? true : false
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Connect to printer
app.post('/connect', async (req, res) => {
  try {
    const config = req.body;
    const result = await connectPrinter(config);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Print endpoint (generic)
app.post('/print', async (req, res) => {
  try {
    const { type, content, receipt, kot } = req.body;
    
    if (!currentPrinter) {
      // Try auto-connect to first USB printer
      const usbPrinters = detectUSBPrinters();
      if (usbPrinters.length > 0) {
        await connectPrinter({ type: 'USB', ...usbPrinters[0] });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'No printer connected. Call /connect first or plug in a USB printer.' 
        });
      }
    }

    if (type === 'kot' || kot) {
      await printKOT(kot || { items: content });
    } else {
      await printReceipt(receipt || content);
    }

    res.json({ success: true, message: 'Printed successfully' });
  } catch (error) {
    console.error('Print error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Print receipt
app.post('/print-receipt', async (req, res) => {
  try {
    const { content, printer } = req.body;
    
    if (!currentPrinter) {
      const usbPrinters = detectUSBPrinters();
      if (usbPrinters.length > 0) {
        await connectPrinter({ type: 'USB', ...usbPrinters[0] });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'No printer connected' 
        });
      }
    }

    await printReceipt(content);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Print KOT
app.post('/print-kot', async (req, res) => {
  try {
    const { table, orderId, items, time } = req.body;
    
    if (!currentPrinter) {
      const usbPrinters = detectUSBPrinters();
      if (usbPrinters.length > 0) {
        await connectPrinter({ type: 'USB', ...usbPrinters[0] });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'No printer connected' 
        });
      }
    }

    await printKOT({ table, orderId, items, time });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test print
app.get('/test', async (req, res) => {
  try {
    if (!currentPrinter) {
      const usbPrinters = detectUSBPrinters();
      if (usbPrinters.length > 0) {
        await connectPrinter({ type: 'USB', ...usbPrinters[0] });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'No printer connected' 
        });
      }
    }

    await printReceipt(`
================================
     OYEBILL TEST PRINT
================================
Date: ${new Date().toLocaleString()}

This is a test print from
the Oyebill Print Agent.

Thank you for choosing
Oyebill.com!

================================
    `);
    
    res.json({ success: true, message: 'Test print sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 8181;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║       Oyebill Print Agent v1.0            ║
╠═══════════════════════════════════════════╣
║  Status: Ready                            ║
║  Port: ${PORT}                                ║
║  URL: http://localhost:${PORT}               ║
╠═══════════════════════════════════════════╣
║  Endpoints:                               ║
║  GET  /health     - Check status          ║
║  GET  /printers   - List USB printers     ║
║  POST /connect    - Connect to printer     ║
║  POST /print      - Print receipt/KOT     ║
║  POST /print-kot  - Print KOT only        ║
║  GET  /test       - Test print            ║
╚═══════════════════════════════════════════╝
  `);
  
  // Auto-connect to first USB printer
  setTimeout(async () => {
    try {
      const printers = detectUSBPrinters();
      if (printers.length > 0) {
        console.log(`Auto-connecting to: ${printers[0].name}`);
        await connectPrinter({ type: 'USB', ...printers[0] });
        console.log('Printer connected successfully!');
      }
    } catch (e) {
      console.log('No USB printer found. Connect a printer and call /connect');
    }
  }, 1000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (printerDevice) {
    printerDevice.close();
  }
  process.exit(0);
});