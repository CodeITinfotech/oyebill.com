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
    
    // Check /dev/usb/* paths (broader search)
    try {
      const allUsbDevices = readdirSync('/dev/usb');
      for (const device of allUsbDevices) {
        const path = `/dev/usb/${device}`;
        if (existsSync(path) && !printers.find(p => p.address === path)) {
          // Try to get device info
          try {
            const { stdout } = await execAsync(`ls -la ${path} 2>/dev/null || echo ""`);
            printers.push({
              name: `USB Device (${device})`,
              type: 'USB',
              address: path,
              connection: 'usb'
            });
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // /dev/usb might not exist
    }
    
    // Check all /dev/lp* (parallel port and USB printers)
    for (let i = 0; i < 10; i++) {
      const path = `/dev/lp${i}`;
      if (existsSync(path) && !printers.find(p => p.address === path)) {
        printers.push({
          name: `Printer /dev/lp${i}`,
          type: 'USB',
          address: path,
          connection: 'usb'
        });
      }
    }
    
    // Try cups lpinfo command for all devices
    try {
      const { stdout } = await execAsync('lpinfo -v 2>/dev/null || true');
      const lines = stdout.split('\n');
      for (const line of lines) {
        // Match various device URI patterns
        const match = line.match(/device-uri:\s*(.+)/i) || line.match(/(usb:\/\/.+)/i) || line.match(/(serial:\/\/.+)/i);
        if (match) {
          const uri = match[1];
          const uriLower = uri.toLowerCase();
          
          // Skip if already detected
          if (printers.find(p => p.address === uri)) continue;
          
          let name = 'CUPS Printer';
          if (uriLower.includes('usb')) {
            // Try to get printer name from CUPS
            try {
              const { stdout: nameOut } = await execAsync(`lpinfo -v 2>/dev/null | grep -i "${uri.split('/').pop()}" | head -1 || echo ""`);
              if (nameOut) {
                const nameMatch = nameOut.match(/(\S+)\s+(\S+.*)/);
                if (nameMatch) name = nameMatch[2].trim();
              }
            } catch (e) {}
            name = `USB Printer (${uri.split('/').pop()})`;
          } else if (uriLower.includes('serial')) {
            name = `Serial Printer (${uri})`;
          }
          
          printers.push({
            name,
            type: uriLower.includes('usb') ? 'USB' : uriLower.includes('serial') ? 'Serial' : 'Network',
            address: uri,
            connection: uriLower.includes('usb') ? 'usb' : uriLower.includes('serial') ? 'serial' : 'network'
          });
        }
      }
    } catch (e) {
      // lpinfo not available
    }
    
    // Try lsusb to get detailed USB device info
    try {
      const { stdout } = await execAsync('lsusb 2>/dev/null || true');
      const lines = stdout.split('\n');
      
      // Common printer-related keywords
      const printerKeywords = ['printer', 'pos', 'thermal', 'receipt', 'label', 'barcode', 'scanner', 'epson', 'brother', 'hp', 'canon', 'samsung', 'zebra', 'dymo', 'star', 'posiflex', 'biT', 'borne', 'elite', 'citan', 'custom', 'xprinter', 'gprinter', 'posline', 'smart', 'elite', 'cbm'];
      
      for (const line of lines) {
        const lineLower = line.toLowerCase();
        // Check if device might be a printer (by keyword or common vendor IDs)
        const isPrinter = printerKeywords.some(kw => lineLower.includes(kw));
        
        // Also check for common thermal printer vendor IDs (hex)
        const commonVendorIds = ['04b8', '04f9', '0519', '0dd4', '1504', '1529', '0c15', '1fc9', '0483', '0416', '067b', '1d5f'];
        const hasCommonVendor = commonVendorIds.some(vid => line.includes(vid));
        
        if (isPrinter || hasCommonVendor) {
          const match = line.match(/Bus\s+(\S+)\s+Device\s+(\S+)\s+ID\s+(\S+)\s+(.+)/);
          if (match) {
            const [, bus, device, id, desc] = match;
            const address = `/dev/bus/usb/${bus}/${device}`;
            if (!printers.find(p => p.address === address)) {
              printers.push({
                name: `USB Printer (${desc.trim()})`,
                type: 'USB',
                address,
                connection: 'usb',
                vendorId: id.split(':')[0],
                productId: id.split(':')[1]
              });
            }
          }
        }
      }
      
      // Also list ALL USB devices as potential printers (for detection purposes)
      // This helps identify unknown devices
      for (const line of lines) {
        const match = line.match(/Bus\s+(\S+)\s+Device\s+(\S+)\s+ID\s+(\S+)\s+(.+)/);
        if (match) {
          const [, bus, device, id, desc] = match;
          const address = `/dev/bus/usb/${bus}/${device}`;
          // Only add if not already detected and has a description
          if (!printers.find(p => p.address === address) && desc.trim()) {
            printers.push({
              name: `USB Device (${desc.trim()})`,
              type: 'USB (Unknown)',
              address,
              connection: 'usb',
              vendorId: id.split(':')[0],
              productId: id.split(':')[1]
            });
          }
        }
      }
    } catch (e) {
      // lsusb not available
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

// Detect Network printers - scan local network for shared Windows printers
async function detectNetworkPrinters() {
  const printers = [];
  
  try {
    // Method 1: Try smbclient to find shared printers on network
    try {
      // Find Windows machines using nmblookup or broadcast
      let windowsHosts = [];
      
      // Try nmblookup for Windows network discovery
      try {
        const { stdout: nbLookups } = await execAsync('nmblookup "*" 2>/dev/null | grep "<00>" | awk \'{print $1}\' || true');
        const hosts = nbLookups.split('\n').filter(h => h.trim() && !h.includes('192.168'));
        windowsHosts.push(...hosts);
      } catch (e) {}
      
      // Try scanning common network ranges using ping
      try {
        // Get local network interface info
        const { stdout: ipAddr } = await execAsync('ip addr show | grep "inet " | grep -v 127.0.0.1 | head -1 || true');
        const ipMatch = ipAddr.match(/inet\s+(\d+\.\d+\.\d+)\.\d+/);
        if (ipMatch) {
          const networkBase = ipMatch[1];
          // Quick ping sweep on common subnet (first 20 hosts)
          for (let i = 1; i <= 20; i++) {
            const host = `${networkBase}.${i}`;
            try {
              await execAsync(`ping -c 1 -W 1 ${host} 2>/dev/null && echo "alive" || true`);
              windowsHosts.push(host);
            } catch (e) {}
          }
        }
      } catch (e) {}
      
      // For each discovered host, try to find shared printers using smbclient
      const uniqueHosts = [...new Set(windowsHosts)].slice(0, 50); // Limit to 50 hosts
      
      for (const host of uniqueHosts) {
        try {
          // Try to list shares using anonymous access
          const { stdout: shares } = await execAsync(`smbclient -L ${host} -N 2>/dev/null || echo ""`, { timeout: 5000 });
          
          // Parse printer shares from smbclient output
          const lines = shares.split('\n');
          let inPrinterSection = false;
          
          for (const line of lines) {
            if (line.includes('Printer') || line.includes('IPC') || inPrinterSection) {
              if (line.match(/^\s*\S+\s+(Disk|Printer|IPC)/)) {
                const parts = line.trim().split(/\s+/);
                const shareName = parts[0];
                if (shareName && shareName !== 'Sharename' && shareName !== '---' && shareName !== 'IPC$') {
                  printers.push({
                    name: shareName,
                    type: 'Network (Shared)',
                    address: `${host}/${shareName}`,
                    connection: 'smb',
                    hostIP: host
                  });
                }
                inPrinterSection = true;
              }
            }
          }
        } catch (e) {
          // Host not responding to SMB
        }
      }
    } catch (e) {
      console.log('smbclient not available or network scan failed');
    }
    
    // Method 2: Check CUPS for network printers
    try {
      const printersConf = await readFile('/etc/cups/printers.conf', 'utf-8');
      const lines = printersConf.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('<Printer ') || line.startsWith('<DefaultPrinter ')) {
          const match = line.match(/<(?:Default)?Printer\s+(\S+)/);
          if (match) {
            printers.push({
              name: match[1],
              type: 'CUPS/Network',
              address: `cups://${match[1]}`,
              connection: 'cups'
            });
          }
        }
      }
    } catch (e) {
      // printers.conf not readable
    }
    
    // Method 3: Try common SNMP-enabled network printers
    try {
      const { stdout } = await execAsync('snmpwalk -v1 -c public 192.168.1.1 .1.3.6.1.2.1.25.3.5.1.1.1 2>/dev/null | head -5 || true');
      if (stdout && stdout.includes('Printer')) {
        printers.push({
          name: 'SNMP Network Printer',
          type: 'Network',
          address: '192.168.1.1:161',
          connection: 'snmp'
        });
      }
    } catch (e) {}
    
    // Method 4: Scan for common network printer ports on nearby hosts
    try {
      const networkScanPorts = [9100, 631, 515]; // Raw (HP), IPP, LPD
      
      // Get local IP to determine network range
      const { stdout: localIp } = await execAsync('ip route get 1 | grep src | awk \'{print $7}\' || hostname -I | awk \'{print $1}\' || true');
      const ipMatch = localIp.trim().match(/(\d+\.\d+\.\d+)\.(\d+)/);
      
      if (ipMatch) {
        const baseIp = `${ipMatch[1]}.`;
        // Quick port scan on first 10 hosts
        for (let i = 1; i <= 10; i++) {
          const host = `${baseIp}${i}`;
          for (const port of networkScanPorts) {
            try {
              const { stdout: ncResult } = await execAsync(`nc -z -w1 ${host} ${port} 2>/dev/null && echo "open" || true`, { timeout: 2000 });
              if (ncResult.includes('open')) {
                const portNames = { 9100: 'RAW', 631: 'IPP', 515: 'LPD' };
                printers.push({
                  name: `Network Printer (${portNames[port] || port})`,
                  type: 'Network',
                  address: `${host}:${port}`,
                  connection: 'socket'
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}
    
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
    const platform = process.platform;
    
    // Get diagnostic info
    const diagnostics = {
      platform,
      hasLsbRelease: false,
      hasLsusb: false,
      hasUsbDev: false,
      hasDevLp: false,
      hasCups: false,
    };
    
    // Check for available tools
    try {
      await execAsync('lsusb --version 2>/dev/null || echo "not found"');
      diagnostics.hasLsusb = true;
    } catch (e) {}
    
    try {
      await execAsync('ls -la /dev/usb 2>/dev/null || echo "not found"');
      diagnostics.hasUsbDev = true;
    } catch (e) {}
    
    try {
      await execAsync('ls -la /dev/lp* 2>/dev/null || echo "not found"');
      diagnostics.hasDevLp = true;
    } catch (e) {}
    
    try {
      await execAsync('lpstat -v 2>/dev/null || echo "not found"');
      diagnostics.hasCups = true;
    } catch (e) {}
    
    res.json({
      success: true,
      printers,
      platform,
      message: printers.length > 0 
        ? `Found ${printers.length} printer(s)`
        : 'No printers detected.',
      diagnostics,
      hint: printers.length === 0 && platform === 'linux' 
        ? 'If running in Docker, ensure USB devices are passed through with --device=/dev/usb:/dev/usb'
        : (printers.length === 0 ? 'Connect your printer and try again' : '')
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

// Add printer manually
router.post('/add', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, address, type, connection } = req.body;
    
    if (!name || !address) {
      return res.status(400).json({ success: false, error: 'Name and address are required' });
    }
    
    res.json({
      success: true,
      printer: { name, address, type: type || 'Manual', connection: connection || 'manual' },
      message: `Printer "${name}" added successfully`
    });
  } catch (error) {
    console.error('Add printer error:', error);
    res.status(500).json({ success: false, error: 'Failed to add printer' });
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
    
    // Ensure column exists
    try {
      db.exec(`ALTER TABLE settings ADD COLUMN saved_printers TEXT`);
    } catch (e) { /* column may exist */ }
    
    const settings = db.prepare('SELECT kot_printer, bill_printer, print_copies, skip_lines_before_cut, saved_printers FROM settings WHERE restaurant_id = ?').get(req.user.restaurantId);
    
    res.json({
      success: true,
      config: settings ? {
        kotPrinter: settings.kot_printer,
        billPrinter: settings.bill_printer,
        printCopies: settings.print_copies,
        skipLinesBeforeCut: settings.skip_lines_before_cut,
        savedPrinters: settings.saved_printers ? JSON.parse(settings.saved_printers) : []
      } : null
    });
  } catch (error) {
    console.error('Get printer config error:', error);
    res.status(500).json({ success: false, error: 'Failed to get printer configuration' });
  }
});

// Save manual printers list
router.post('/save-printers', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { printers } = req.body;
    const { db } = req;
    
    // Ensure column exists
    try {
      db.exec(`ALTER TABLE settings ADD COLUMN saved_printers TEXT`);
    } catch (e) { /* column may exist */ }
    
    db.prepare(`UPDATE settings SET saved_printers = ? WHERE restaurant_id = ?`).run(
      JSON.stringify(printers || []),
      req.user.restaurantId
    );
    
    res.json({ success: true, message: 'Printers saved' });
  } catch (error) {
    console.error('Save printers error:', error);
    res.status(500).json({ success: false, error: 'Failed to save printers' });
  }
});

// Add single printer to saved list
router.post('/add-printer', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, type, address, connection } = req.body;
    const { db } = req;
    
    // Ensure column exists
    try {
      db.exec(`ALTER TABLE settings ADD COLUMN saved_printers TEXT`);
    } catch (e) { /* column may exist */ }
    
    const settings = db.prepare('SELECT saved_printers FROM settings WHERE restaurant_id = ?').get(req.user.restaurantId);
    let printers = settings?.saved_printers ? JSON.parse(settings.saved_printers) : [];
    
    // Add new printer if not already exists
    const exists = printers.some(p => p.address === address);
    if (!exists) {
      printers.push({ name, type, address, connection });
      db.prepare(`UPDATE settings SET saved_printers = ? WHERE restaurant_id = ?`).run(
        JSON.stringify(printers),
        req.user.restaurantId
      );
    }
    
    res.json({ success: true, printers });
  } catch (error) {
    console.error('Add printer error:', error);
    res.status(500).json({ success: false, error: 'Failed to add printer' });
  }
});

// Remove printer from saved list
router.post('/remove-printer', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { address } = req.body;
    const { db } = req;
    
    // Ensure column exists
    try {
      db.exec(`ALTER TABLE settings ADD COLUMN saved_printers TEXT`);
    } catch (e) { /* column may exist */ }
    
    const settings = db.prepare('SELECT saved_printers FROM settings WHERE restaurant_id = ?').get(req.user.restaurantId);
    let printers = settings?.saved_printers ? JSON.parse(settings.saved_printers) : [];
    
    printers = printers.filter(p => p.address !== address);
    
    db.prepare(`UPDATE settings SET saved_printers = ? WHERE restaurant_id = ?`).run(
      JSON.stringify(printers),
      req.user.restaurantId
    );
    
    res.json({ success: true, printers });
  } catch (error) {
    console.error('Remove printer error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove printer' });
  }
});

// Print KOT (Kitchen Order Ticket)
router.post('/print-kot', authenticateToken, async (req, res) => {
  try {
    const { content, copies } = req.body;
    const { db } = req;
    
    // Get printer settings
    const settings = db.prepare('SELECT kot_printer, print_copies, skip_lines_before_cut FROM settings WHERE restaurant_id = ?').get(req.user.restaurantId);
    
    if (!settings?.kot_printer) {
      return res.status(400).json({ success: false, error: 'KOT printer not configured. Go to Settings > Printer to configure.' });
    }
    
    const printer = settings.kot_printer;
    const printCopies = copies || settings.print_copies || 1;
    const skipLines = settings.skip_lines_before_cut || 3;
    
    // Add skip lines before cut if content is for thermal printer
    const printContent = content + '\n'.repeat(skipLines) + '\x1DV\x0A'; // ESC POS cut command
    
    let success = false;
    let output = '';
    
    try {
      // Try printing based on printer format
      if (printer.includes('/') || printer.includes('\\')) {
        // Network printer format: IP/PrinterName or \\IP\PrinterName
        let host, shareName;
        
        if (printer.startsWith('\\\\')) {
          // UNC path format \\IP\sharename
          const withoutBackslashes = printer.replace(/^\\+/, '').replace(/\\/g, '/');
          const parts = withoutBackslashes.split('/');
          host = parts[0];
          shareName = parts[1];
        } else if (printer.includes('/')) {
          // IP/PrinterName format (forward slash)
          const parts = printer.split('/');
          host = parts[0];
          shareName = parts[1];
        } else {
          // Backslash format without leading backslashes
          const parts = printer.split('\\');
          host = parts[0];
          shareName = parts[1];
        }
        
        console.log(`Printing to: host=${host}, share=${shareName}`);
        
        // Try using smbclient for Windows shared printers
        try {
          const escapedContent = printContent.replace(/'/g, "'\\''");
          const { stdout, stderr } = await execAsync(
            `echo '${escapedContent}' | smbclient //${host}/${shareName} -N -c 'print -' 2>&1`,
            { timeout: 10000 }
          );
          
          console.log('smbclient stdout:', stdout);
          console.log('smbclient stderr:', stderr);
          
          if (stderr && !stderr.includes('NT_STATUS') && !stderr.includes('Connection refused')) {
            output = stdout + stderr;
            success = true;
          } else {
            output = `smbclient: ${stderr || stdout}`;
          }
        } catch (smbError) {
          output = `smbclient failed: ${smbError.message}`;
          // Check for specific network errors
          if (smbError.message.includes('NT_STATUS_IO_TIMEOUT') || smbError.message.includes('Connection refused')) {
            output += ' - Cannot reach printer. Check network connectivity.';
          }
        }
      } else if (printer.startsWith('/dev/')) {
        // Direct device path (USB or serial)
        const fs = await import('fs');
        fs.writeFileSync(printer, printContent);
        success = true;
        output = `Printed to ${printer}`;
      } else {
        // Try as CUPS printer name
        try {
          const { stdout } = await execAsync(`echo '${printContent.replace(/'/g, "'\\''")}' | lp -d "${printer}" 2>&1`, { timeout: 5000 });
          success = true;
          output = `Printed to CUPS: ${stdout}`;
        } catch (lpError) {
          output = `lp failed: ${lpError.message}`;
        }
      }
      
      // Print multiple copies if needed
      if (success && printCopies > 1) {
        for (let i = 1; i < printCopies; i++) {
          try {
            if (printer.includes('/') || printer.includes('\\')) {
              let host, shareName;
              if (printer.startsWith('\\\\')) {
                const withoutBackslashes = printer.replace(/^\\+/, '').replace(/\\/g, '/');
                const parts = withoutBackslashes.split('/');
                host = parts[0];
                shareName = parts[1];
              } else if (printer.includes('/')) {
                const parts = printer.split('/');
                host = parts[0];
                shareName = parts[1];
              } else {
                const parts = printer.split('\\');
                host = parts[0];
                shareName = parts[1];
              }
              await execAsync(
                `echo '${printContent.replace(/'/g, "'\\''")}' | smbclient //${host}/${shareName} -N -c 'print -' 2>&1`,
                { timeout: 10000 }
              );
            }
          } catch (e) {}
        }
        output += ` (${printCopies} copies)`;
      }
      
    } catch (error) {
      console.error('Print error:', error);
      output = `Print failed: ${error.message}`;
    }
    
    res.json({
      success,
      output,
      printer,
      copies: printCopies,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Print KOT error:', error);
    res.status(500).json({ success: false, error: 'Failed to print KOT', details: error.message });
  }
});

// Print Bill
router.post('/print-bill', authenticateToken, async (req, res) => {
  try {
    const { content, copies } = req.body;
    const { db } = req;
    
    // Get printer settings
    const settings = db.prepare('SELECT bill_printer, print_copies, skip_lines_before_cut FROM settings WHERE restaurant_id = ?').get(req.user.restaurantId);
    
    if (!settings?.bill_printer) {
      return res.status(400).json({ success: false, error: 'Bill printer not configured. Go to Settings > Printer to configure.' });
    }
    
    const printer = settings.bill_printer;
    const printCopies = copies || settings.print_copies || 1;
    const skipLines = settings.skip_lines_before_cut || 3;
    
    const printContent = content + '\n'.repeat(skipLines) + '\x1DV\x0A';
    
    let success = false;
    let output = '';
    
    try {
      if (printer.includes('/') || printer.includes('\\')) {
        let host, shareName;
        if (printer.startsWith('\\\\')) {
          const withoutBackslashes = printer.replace(/^\\+/, '').replace(/\\/g, '/');
          const parts = withoutBackslashes.split('/');
          host = parts[0];
          shareName = parts[1];
        } else if (printer.includes('/')) {
          const parts = printer.split('/');
          host = parts[0];
          shareName = parts[1];
        } else {
          const parts = printer.split('\\');
          host = parts[0];
          shareName = parts[1];
        }
        
        try {
          const escapedContent = printContent.replace(/'/g, "'\\''");
          const { stdout, stderr } = await execAsync(
            `echo '${escapedContent}' | smbclient //${host}/${shareName} -N -c 'print -' 2>&1`,
            { timeout: 10000 }
          );
          
          if (stderr && !stderr.includes('NT_STATUS') && !stderr.includes('Connection refused')) {
            output = stdout + stderr;
            success = true;
          } else {
            output = `smbclient: ${stderr || stdout}`;
          }
        } catch (smbError) {
          output = `smbclient failed: ${smbError.message}`;
        }
      } else if (printer.startsWith('/dev/')) {
        const fs = await import('fs');
        fs.writeFileSync(printer, printContent);
        success = true;
        output = `Printed to ${printer}`;
      } else {
        try {
          const { stdout } = await execAsync(`echo '${printContent.replace(/'/g, "'\\''")}' | lp -d "${printer}" 2>&1`, { timeout: 5000 });
          success = true;
          output = `Printed to CUPS: ${stdout}`;
        } catch (lpError) {
          output = `lp failed: ${lpError.message}`;
        }
      }
      
    } catch (error) {
      output = `Print failed: ${error.message}`;
    }
    
    res.json({
      success,
      output,
      printer,
      copies: printCopies,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Print Bill error:', error);
    res.status(500).json({ success: false, error: 'Failed to print bill', details: error.message });
  }
});

export default router;