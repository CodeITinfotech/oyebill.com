/**
 * QZ Tray Print Service for POS Thermal Printers
 * Handles silent printing without browser dialog
 */

declare global {
  interface Window {
    qz?: any;
  }
}

let isQZConnected = false;

export interface PrintConfig {
  printerName?: string;
  width?: number;
  height?: number;
}

const ESC = '\x1B';
const GS = '\x1D';

const COMMANDS = {
  INIT: ESC + '@',
  ALIGN_CENTER: ESC + 'a\x01',
  ALIGN_LEFT: ESC + 'a\x00',
  BOLD_ON: ESC + 'E\x01',
  BOLD_OFF: ESC + 'E\x00',
  DOUBLE_HEIGHT: GS + '!\x10',
  DOUBLE_SIZE: GS + '!\x30',
  NORMAL_SIZE: GS + '!\x00',
  CUT: GS + 'V\x00',
  PARTIAL_CUT: GS + 'V\x01',
  FEED_LINES: (n: number) => ESC + 'd' + String.fromCharCode(n),
};

export async function initQZTray(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!window.qz) {
      console.log('QZ Tray not detected');
      resolve(false);
      return;
    }
    const config = { host: 'localhost', port: 8181 };
    window.qz.websocket.connect(config).then(() => {
      console.log('QZ Tray connected');
      isQZConnected = true;
      resolve(true);
    }).catch(() => {
      isQZConnected = false;
      resolve(false);
    });
  });
}

export async function disconnectQZTray(): Promise<void> {
  if (window.qz && isQZConnected) {
    await window.qz.websocket.disconnect();
    isQZConnected = false;
  }
}

export async function getPrinters(): Promise<string[]> {
  if (!window.qz || !isQZConnected) {
    await initQZTray();
  }
  if (!window.qz || !isQZConnected) return [];
  try {
    return await window.qz.printers.find();
  } catch {
    return [];
  }
}

export async function printText(content: string, config: PrintConfig = {}): Promise<boolean> {
  if (!window.qz || !isQZConnected) {
    console.log('QZ Tray not connected - using browser print');
    window.print();
    return false;
  }
  try {
    const printer = config.printerName || 'default';
    const printData = [
      { type: 'raw', format: 'plain', data: COMMANDS.INIT },
      { type: 'raw', format: 'plain', data: content },
      { type: 'raw', format: 'plain', data: COMMANDS.FEED_LINES(3) + COMMANDS.CUT },
    ];
    await window.qz.print({}, { printer, size: { width: config.width || 80, height: config.height || 200, units: 'mm' } });
    console.log('Print sent to:', printer);
    return true;
  } catch (err) {
    console.error('Print error:', err);
    return false;
  }
}

export function formatBillForPrinter(billData: any): string {
  const width = 48;
  const divider = '-'.repeat(width);
  const center = (text: string) => text.padStart((width + text.length) / 2).padEnd(width);
  const left = (label: string, value: string) => `${label}: ${value}`.padEnd(width);
  
  let output = '';
  output += COMMANDS.INIT + COMMANDS.BOLD_ON + COMMANDS.DOUBLE_SIZE;
  output += center(billData.restaurantName || 'Restaurant') + '\n';
  output += COMMANDS.NORMAL_SIZE + COMMANDS.BOLD_OFF;
  if (billData.address) output += center(billData.address) + '\n';
  if (billData.phone) output += center('Ph: ' + billData.phone) + '\n';
  output += divider + '\n' + center('TAX INVOICE') + '\n' + divider + '\n';
  output += left('Bill No', billData.orderId || '') + '\n';
  output += left('Table', billData.tableNumber || '') + '\n';
  output += left('Date', billData.dateTime || '') + '\n';
  output += left('Waiter', billData.waiterName || '') + '\n';
  output += divider + '\n';
  output += left('Item', '') + '\n' + left('---', '') + '\n';
  
  billData.items?.forEach((item: any) => {
    const name = (item.productName || '').substring(0, 25);
    const qty = item.quantity || 1;
    const rate = (item.unitPrice || 0).toFixed(2);
    const amount = ((item.unitPrice || 0) * qty).toFixed(2);
    output += name + '\n';
    output += left('', `x${qty} @ Rs.${rate} = Rs.${amount}`) + '\n';
  });
  
  output += divider + '\n';
  output += left('Subtotal', `Rs.${(billData.subtotal || 0).toFixed(2)}`) + '\n';
  if (billData.taxAmount > 0) {
    output += left('CGST', `Rs.${((billData.taxAmount || 0) / 2).toFixed(2)}`) + '\n';
    output += left('SGST', `Rs.${((billData.taxAmount || 0) / 2).toFixed(2)}`) + '\n';
  }
  if (billData.discount > 0) {
    output += left('Discount', `-Rs.${(billData.discount || 0).toFixed(2)}`) + '\n';
  }
  output += divider + '\n';
  output += COMMANDS.BOLD_ON + COMMANDS.DOUBLE_HEIGHT;
  output += left('TOTAL', `Rs.${(billData.total || 0).toFixed(2)}`) + '\n';
  output += COMMANDS.NORMAL_SIZE + COMMANDS.BOLD_OFF;
  if (billData.totalInWords) output += center(`(${billData.totalInWords})`) + '\n';
  output += divider + '\n';
  output += center('Thank You!') + '\n';
  output += center('Please visit again') + '\n';
  output += COMMANDS.FEED_LINES(4) + COMMANDS.PARTIAL_CUT;
  return output;
}

export function formatKOTForPrinter(kotData: any): string {
  const width = 48;
  const divider = '='.repeat(width);
  const center = (text: string) => text.padStart((width + text.length) / 2).padEnd(width);
  const left = (label: string, value: string) => `${label}: ${value}`.padEnd(width);
  const indent = (text: string) => '  ' + text;
  
  let output = '';
  output += COMMANDS.INIT + COMMANDS.BOLD_ON + COMMANDS.DOUBLE_SIZE;
  output += center('KITCHEN ORDER TICKET') + '\n';
  output += COMMANDS.NORMAL_SIZE + COMMANDS.BOLD_OFF;
  output += divider + '\n';
  output += left('KOT No', kotData.orderId || '') + '\n';
  output += left('Table', kotData.tableNumber || '') + '\n';
  output += left('Date', kotData.dateTime || '') + '\n';
  if (kotData.waiterName) output += left('Waiter', kotData.waiterName) + '\n';
  if (kotData.customerName) output += left('Customer', kotData.customerName) + '\n';
  output += divider + '\n';
  
  kotData.items?.forEach((item: any, idx: number) => {
    output += COMMANDS.BOLD_ON + COMMANDS.DOUBLE_HEIGHT;
    output += `${idx + 1}. ${item.productName || 'Item'}\n`;
    output += COMMANDS.NORMAL_SIZE + left('', `Qty: ${item.quantity || 1}`) + '\n';
    
    // Print modifiers
    if (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0) {
      output += COMMANDS.BOLD_ON + indent('MODIFIERS:') + COMMANDS.BOLD_OFF + '\n';
      item.modifiers.forEach((mod: any) => {
        const modName = typeof mod === 'string' ? mod : mod.name || mod;
        const modQty = typeof mod === 'object' && mod.quantity ? ` x${mod.quantity}` : '';
        output += indent(`• ${modName}${modQty}`) + '\n';
      });
    }
    
    // Print cooking instructions
    if (item.cookingInstructions) {
      output += COMMANDS.BOLD_ON + indent('NOTE:') + COMMANDS.BOLD_OFF + '\n';
      output += indent(`⚠ ${item.cookingInstructions}`) + '\n';
    }
  });
  
  output += divider + '\n' + COMMANDS.FEED_LINES(3) + COMMANDS.CUT;
  return output;
}

export function isQZTrayAvailable(): boolean {
  return !!(window.qz && isQZConnected);
}

export default { initQZTray, disconnectQZTray, getPrinters, printText, formatBillForPrinter, formatKOTForPrinter, isQZTrayAvailable };
