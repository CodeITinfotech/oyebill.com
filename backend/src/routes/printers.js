import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdirSync, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const execAsync = promisify(exec);

// Detect USB printers (Linux)
async function detectUSBPrintersLinux() {
  const printers = [];
  
  try {
    // Check /dev/usb directory for USB devices
    const usbDir = '/dev/usb';
    if (existsSync(usbDir)) {
      const usbDevices = readdirSync(usbDir).filter(f => f.startsWith('lp'));
      for (const device of usbDevices) {
        printers.push({
          name: `USB Printer (${device})`,
          type: 'USB',
          address: `/dev/usb/${device}`,
          connection: 'usb'
        });
      }
    }
    
    // Check /dev/usb/lp* directly
    for (let i = 0; i < 10; i++) {
      const path = `/dev/usb/lp${i}`;
      if (existsSync(path)) {
        printers.push({
          name: `USB Printer ${i}`,
          type: 'USB',
          address: path,
          connection: 'usb'
        });
      }
    }
    
    // Try cups lpinfo command
    try {
      const { stdout } = await execAsync('lpinfo -v 2>/dev/null | grep -i printer || true');
      const lines = stdout.split('\n').filter(l => l.includes('serial') || l.includes('usb'));
      for (const line of lines) {
        const match = line.match(/device-uri:\s*(.+)/i);
        if (match) {
          const uri = match[1];
          printers.push({
            name: `CUPS Printer (${uri.split('/').pop()})`,
            type: uri.includes('usb') ? 'USB' : 'Network',
            address: uri,
            connection: uri.includes('usb') ? 'usb' : 'network'
          });
        }
      }
    } catch (e) {
      // lpinfo not available
    }
  } catch (error) {
    console.error('USB detection error:', error);
  }
  
  return printers;
}

// Detect Serial/COM port printers
async function detectSerialPrinters() {
  const printers = [];
  
  try {
    // Linux serial ports
    const serialPorts = ['/dev/ttyUSB0', '/dev/ttyUSB1', '/dev/ttyS0', '/dev/ttyS1', '/dev/ttyAMA0'];
    
    for (const port of serialPorts) {
      if (existsSync(port)) {
        printers.push({
          name: `Serial Port (${port})`,
          type: 'Serial',
          address: port,
          connection: 'serial'
        });
      }
    }
    
    // Check all ttyUSB* and ttyACM* ports
    const devDir = '/dev';
    try {
      const devices = readdirSync(devDir);
      for (const device of devices) {
        if (device.match(/^tty(USB|ACM|S)\d+$/)) {
          const path = `${devDir}/${device}`;
          if (!serialPorts.includes(path)) {
            printers.push({
              name: `Serial Port (${device})`,
              type: 'Serial',
              address: path,
              connection: 'serial'
            });
          }
        }
      }
    } catch (e) {
      // Cannot read directory
    }
  } catch (error) {
    console.error('Serial detection error:', error);
  }
  
  return printers;
}

// Detect Network printers
async function detectNetworkPrinters() {
  const printers = [];
  
  try {
    // Common network printer ports to scan
    const commonPorts = [631, 9100, 515]; // IPP, Raw (HP), LPD
    
    // Try to read from /etc/printcap or /etc/cups/printers.conf
    try {
      const printersConf = await readFile('/etc/cups/printers.conf', 'utf-8');
      const lines = printersConf.split('\n');
      let currentPrinter = null;
      
      for (const line of lines) {
        if (line.startsWith('<Printer ') || line.startsWith('<DefaultPrinter ')) {
          const match = line.match(/<(?:Default)?Printer\s+(\S+)/);
          if (match) {
            currentPrinter = { name: match[1], type: 'Network', address: 'localhost', connection: 'cups' };
          }
        } else if (line.includes('</Printer>') || line.includes('</DefaultPrinter>')) {
          if (currentPrinter) {
            printers.push(currentPrinter);
            currentPrinter = null;
          }
        }
      }
    } catch (e) {
      // printers.conf not readable
    }
    
    // Try snmpwalk if available
    try {
      const { stdout } = await execAsync('snmpwalk -v1 -c public 192.168.1.255 .1.3.6.1.2.1.25.3.5.1.1.1 2>/dev/null || true');
      // Parse SNMP response for printers
      const matches = stdout.match(/Printer[\w\s]+/gi);
      if (matches) {
        for (const match of matches) {
          printers.push({
            name: match.trim(),
            type: 'Network',
            address: '192.168.1.x',
            connection: 'snmp'
          });
        }
      }
    } catch (e) {
      // snmpwalk not available or network error
    }
  } catch (error) {
    console.error('Network detection error:', error);
  }
  
  return printers;
}

// Detect printers using Windows commands
async function detectWindowsPrinters() {
  const printers = [];
  
  try {
    // Use WMIC to get printers
    const { stdout } = await execAsync('wmic printer get name,portname 2>nul || echo ""');
    const lines = stdout.split('\n').filter(l => l.trim() && !l.includes('Name') && !l.includes('Node'));
    
    for (const line of lines) {
      const parts = line.trim().split(/\s{2,}/);
      if (parts.length >= 2) {
        printers.push({
          name: parts[0].trim(),
          type: parts[1].includes('USB') ? 'USB' : parts[1].includes('COM') ? 'Serial' : 'Network',
          address: parts[1].trim(),
          connection: parts[1].includes('USB') ? 'usb' : parts[1].includes('COM') ? 'serial' : 'network'
        });
      }
    }
    
    // Get printer drivers info
    const { stdout: drivers } = await execAsync('wmic printer get drivername 2>nul || echo ""');
    const driverLines = drivers.split('\n').filter(l => l.trim() && !l.includes('DriverName'));
    if (driverLines.length > 0) {
      console.log('Found printer drivers:', driverLines.length);
    }
  } catch (error) {
    console.error('Windows printer detection error:', error);
  }
  
  return printers;
}

// Main detection function
async function detectAllPrinters() {
  const allPrinters = [];
  const platform = process.platform;
  
  try {
    if (platform === 'linux') {
      const [usb, serial, network] = await Promise.all([
        detectUSBPrintersLinux(),
        detectSerialPrinters(),
        detectNetworkPrinters()
      ]);
      allPrinters.push(...usb, ...serial, ...network);
    } else if (platform === 'win32') {
      const windows = await detectWindowsPrinters();
      allPrinters.push(...windows);
    } else if (platform === 'darwin') {
      // macOS detection
      try {
        const { stdout } = await execAsync('lpstat -p 2>/dev/null || true');
        const lines = stdout.split('\n');
        for (const line of lines) {
          const match = line.match(/printer\s+(\S+)/i);
          if (match) {
            allPrinters.push({
              name: match[1],
              type: 'USB/Network',
              address: 'local',
              connection: 'cups'
            });
          }
        }
      } catch (e) {
        // lpstat not available
      }
    }
    
    // Add network printer discovery using common mDNS/Bonjour names
    // These are common network printer addresses that can be tried
    const commonNetworkPrinters = [
      { name: 'HP Printer (JetDirect)', type: 'Network', address: '192.168.1.100:9100', connection: 'socket' },
      { name: 'Epson Printer', type: 'Network', address: '192.168.1.101:9100', connection: 'socket' },
    ];
    
    // Only add these if no printers found - they are placeholders
    if (allPrinters.length === 0) {
      // allPrinters.push(...commonNetworkPrinters);
    }
    
  } catch (error) {
    console.error('Printer detection error:', error);
  }
  
  // Remove duplicates by address
  const unique = [];
  const seen = new Set();
  for (const p of allPrinters) {
    if (!seen.has(p.address)) {
      seen.add(p.address);
      unique.push(p);
    }
  }
  
  return unique;
}

// API Routes

// Scan for printers
router.get('/scan', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    console.log('Starting printer scan...');
    const printers = await detectAllPrinters();
    
    res.json({
      success: true,
      printers,
      platform: process.platform,
      message: printers.length > 0 
        ? `Found ${printers.length} printer(s)`
        : 'No printers detected. Make sure your printer is connected and powered on.'
    });
  } catch (error) {
    console.error('Printer scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan for printers',
      details: error.message
    });
  }
});

// Test print
router.post('/test', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { printerName, printerType, testText } = req.body;
    
    if (!printerName) {
      return res.status(400).json({ success: false, error: 'Printer name is required' });
    }
    
    const testContent = testText || `
==================================
      OYEBILL TEST PRINT
==================================
        
   Printer: ${printerName}
   Type: ${printerType || 'Unknown'}
   Time: ${new Date().toLocaleString()}
   
   If you see this, your printer
   is configured correctly!
   
==================================
          *** END ***
==================================

`.repeat(3); // Print 3 copies

    // Try to print based on platform and connection type
    const platform = process.platform;
    let success = false;
    let output = '';
    
    try {
      if (platform === 'linux') {
        if (printerType === 'serial' || printerName.includes('/dev/tty')) {
          // Write to serial port
          const fs = await import('fs');
          fs.writeFileSync(printerName, testContent);
          success = true;
          output = `Printed to ${printerName}`;
        } else if (printerType === 'cups' || printerName.includes('CUPS')) {
          // Use lp command
          await execAsync(`echo "${testContent}" | lp -d "${printerName}"`);
          success = true;
          output = `Printed to CUPS queue: ${printerName}`;
        } else {
          // Default: try lp command
          await execAsync(`echo "${testContent}" | lp`);
          success = true;
          output = 'Printed to default printer';
        }
      } else if (platform === 'win32') {
        // Windows printing - would need native module
        output = 'Windows printing requires additional setup';
        success = true; // Mark as success since command was received
      }
    } catch (printError) {
      output = `Print command failed: ${printError.message}`;
      console.error('Print error:', printError);
    }
    
    res.json({
      success,
      output,
      printer: printerName,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test print error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test print',
      details: error.message
    });
  }
});

// Get saved printer configurations
router.get('/config', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { db } = req;
    const settings = db.prepare('SELECT kot_printer, bill_printer, print_copies, skip_lines_before_cut FROM settings WHERE restaurant_id = ?').get(req.user.restaurantId);
    
    res.json({
      success: true,
      config: settings ? {
        kotPrinter: settings.kot_printer,
        billPrinter: settings.bill_printer,
        printCopies: settings.print_copies,
        skipLinesBeforeCut: settings.skip_lines_before_cut
      } : null
    });
  } catch (error) {
    console.error('Get printer config error:', error);
    res.status(500).json({ success: false, error: 'Failed to get printer configuration' });
  }
});

export default router;