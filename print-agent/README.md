# Oyebill Print Agent

A local Windows service that enables printing from Oyebill cloud POS to local thermal printers.

## Features

- **USB Printer Support** - Auto-detect and connect to thermal printers
- **Network Printer Support** - Connect to printers over LAN
- **ESC/POS Commands** - Full support for receipt formatting and auto-cut
- **Silent Printing** - No popup windows, direct to printer
- **Auto-Reconnect** - Automatically reconnects if printer is disconnected

## Requirements

- Windows 7/8/10/11
- Node.js 16 or higher
- Thermal printer (ESC/POS compatible)

## Installation

### Option 1: Quick Setup (Recommended)

1. Download or copy this folder to your Windows PC
2. Double-click `setup.bat`
3. Follow the prompts

### Option 2: Manual Setup

```bash
# Open Command Prompt in this folder
cd print-agent

# Install dependencies
npm install

# Start the agent
npm start
```

## Usage

### 1. Start the Agent

Double-click `start.bat` or run `npm start` in the folder.

### 2. Verify Connection

Open your browser and go to:
```
http://localhost:8181/health
```

You should see:
```json
{"status":"ok","printer":"connected","timestamp":"..."}
```

### 3. Test Print

Click the **Test Print** button in Oyebill Settings, or:
```
http://localhost:8181/test
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Check agent status |
| GET | `/printers` | List available USB printers |
| POST | `/connect` | Connect to a specific printer |
| POST | `/print` | Print receipt or KOT |
| POST | `/print-receipt` | Print receipt only |
| POST | `/print-kot` | Print KOT only |
| GET | `/test` | Send test print |

## API Examples

### Print Receipt
```javascript
await fetch('http://localhost:8181/print', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    receipt: 'Thank you for dining!\nTotal: ₹500'
  })
});
```

### Print KOT
```javascript
await fetch('http://localhost:8181/print', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'kot',
    content: '2x Biryani\n1x Naan\n3x Coke'
  })
});
```

### Connect to Network Printer
```javascript
await fetch('http://localhost:8181/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'Network',
    ip: '192.168.0.220',
    port: 9100
  })
});
```

## Supported Printers

Most ESC/POS compatible thermal printers:
- Epson TM-T88
- Epson TM-T82
- Star TSP100
- POS-80 thermal printers
- Any USB thermal receipt printer

## Troubleshooting

### "No printer connected"
1. Make sure the print agent is running
2. Check that your printer is turned on and connected via USB
3. Try going to `http://localhost:8181/printers` to see detected printers
4. Click the test button to trigger auto-detection

### Printer not printing
1. Verify printer is set as default in Windows
2. Try printing from Notepad first
3. Check if the printer cable is secure
4. Restart the print agent

### Port 8181 already in use
```bash
# Find and kill the process using port 8181
netstat -ano | findstr :8181
taskkill /PID <PROCESS_ID> /F
```

## Auto-start on Windows

To start the agent automatically when Windows starts:

1. Press `Win + R`
2. Type `shell:startup` and press Enter
3. Create a shortcut to `start.bat` in that folder

## License

MIT - Oyebill.com