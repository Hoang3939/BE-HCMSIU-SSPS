import fs from 'fs/promises';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execAsync = promisify(exec);

/**
 * Convert document to PDF using LibreOffice (if available)
 * Returns path to converted PDF or null if conversion fails
 */
export async function convertToPdfWithLibreOffice(filePath: string): Promise<string | null> {
  try {
    // Check if LibreOffice is available
    // On Windows: "C:\Program Files\LibreOffice\program\soffice.exe"
    // On Linux/Mac: "soffice" or "/usr/bin/soffice"
    const isWindows = process.platform === 'win32';
    const libreOfficePaths = isWindows
      ? [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      ]
      : ['soffice', '/usr/bin/soffice'];

    // Check if LibreOffice exists by checking file system instead of running command
    let libreOfficeCmd = null;
    const fsSync = await import('fs');
    for (const cmd of libreOfficePaths) {
      if (fsSync.existsSync(cmd)) {
        libreOfficeCmd = cmd;
        console.log(`[pageCounter] Found LibreOffice at: ${cmd}`);
        break;
      }
    }

    if (!libreOfficeCmd) {
      console.error('[pageCounter] LibreOffice not found in any of these paths:', libreOfficePaths);
      throw new Error('LibreOffice không được cài đặt. Vui lòng cài LibreOffice để đếm số trang chính xác.');
    }

    // Create temporary output directory
    const outputDir = path.join(path.dirname(filePath), 'temp_pdf_' + Date.now());
    await fs.mkdir(outputDir, { recursive: true });

    // Convert to PDF using LibreOffice with spawn to have better control over stdin
    // --headless: Run without GUI (no window)
    // --nodefault: Don't start with default document
    // --nolockcheck: Don't check for locked files (prevents prompts)
    // --invisible: Run invisibly (no splash screen)
    // --norestore: Don't restore previous session
    // --convert-to pdf: Convert to PDF
    // --outdir: Output directory
    const args = [
      '--headless',
      '--nodefault',
      '--nolockcheck',
      '--invisible',
      '--norestore',
      '--convert-to',
      'pdf',
      '--outdir',
      outputDir,
      filePath,
    ];

    // Use spawn with stdin pipe to automatically send Enter key
    let exitCode: number | null = null;
    let stderrOutput = '';
    
    await new Promise<void>((resolve, reject) => {
      const libreOfficeProcess = spawn(libreOfficeCmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'], // Use pipe to send input
        windowsHide: true, // Hide window on Windows
        detached: false,
      });

      // Automatically send Enter key to stdin immediately and continuously
      // This bypasses "Press Enter to continue" prompt
      if (libreOfficeProcess.stdin) {
        // Send Enter immediately
        libreOfficeProcess.stdin.write('\n');
        // Also send Enter after delays in case prompt appears later
        setTimeout(() => {
          if (!libreOfficeProcess.stdin.destroyed) {
            libreOfficeProcess.stdin.write('\n');
          }
        }, 500);
        setTimeout(() => {
          if (!libreOfficeProcess.stdin.destroyed) {
            libreOfficeProcess.stdin.write('\n');
            libreOfficeProcess.stdin.end();
          }
        }, 2000);
      }

      // Capture stderr to check for errors (but don't show prompts)
      if (libreOfficeProcess.stderr) {
        libreOfficeProcess.stderr.on('data', (data: Buffer) => {
          stderrOutput += data.toString();
        });
      }

      const timeout = setTimeout(() => {
        libreOfficeProcess.kill();
        reject(new Error('LibreOffice conversion timeout'));
      }, 30000); // 30 second timeout

      libreOfficeProcess.on('close', (code: number | null) => {
        clearTimeout(timeout);
        exitCode = code;
        // Don't reject on non-zero exit code - LibreOffice may still create PDF successfully
        // We'll check for PDF file existence later
        if (code === 0 || code === null) {
          console.log('[pageCounter] LibreOffice conversion process completed with exit code:', code);
        } else {
          console.warn('[pageCounter] LibreOffice exited with code:', code, '(will check for PDF file anyway)');
          if (stderrOutput) {
            console.warn('[pageCounter] LibreOffice stderr:', stderrOutput.substring(0, 500));
          }
        }
        resolve();
      });

      libreOfficeProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Wait longer for LibreOffice to finish writing the PDF file
    // LibreOffice may need more time, especially for complex documents
    await new Promise(resolve => setTimeout(resolve, 3000)); // Increased from 1000ms to 3000ms

    // Find the converted PDF file with retry logic
    // LibreOffice may need more time to write the file, especially for large/complex documents
    let pdfFiles: string[] = [];
    const maxRetries = 5;
    const retryDelay = 1000; // 1 second between retries
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const files = await fs.readdir(outputDir);
        pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
        
        if (pdfFiles.length > 0) {
          console.log(`[pageCounter] Found PDF file after ${attempt + 1} attempt(s)`);
          break;
        }
        
        if (attempt < maxRetries - 1) {
          console.log(`[pageCounter] PDF not found yet, retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error('[pageCounter] Error reading output directory:', error);
        if (attempt === maxRetries - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (pdfFiles.length === 0) {
      console.error('[pageCounter] No PDF file found after LibreOffice conversion after', maxRetries, 'retries');
      console.error('[pageCounter] Exit code:', exitCode);
      console.error('[pageCounter] Output directory:', outputDir);
      try {
        const files = await fs.readdir(outputDir);
        console.error('[pageCounter] Output directory contents:', files);
      } catch (e) {
        console.error('[pageCounter] Could not read output directory');
      }
      
      // Provide more helpful error message based on exit code
      let errorMessage = 'LibreOffice không tạo được file PDF.';
      if (exitCode !== null && exitCode !== 0) {
        errorMessage += ` LibreOffice exited with code ${exitCode}.`;
        if (stderrOutput) {
          const errorLines = stderrOutput.split('\n').filter(line =>
            line.trim() &&
            !line.includes('Warning') &&
            !line.includes('Info') &&
            !line.includes('fontconfig')
          );
          if (errorLines.length > 0) {
            errorMessage += ` ${errorLines.slice(0, 2).join(' ')}`;
          }
        }
        errorMessage += ' Có thể file bị lỗi hoặc LibreOffice không thể xử lý file này.';
      } else {
        errorMessage += ' Kiểm tra file input có hợp lệ không.';
      }
      
      await fs.rmdir(outputDir, { recursive: true }).catch(() => { });
      throw new Error(errorMessage);
    }

    // Use the first PDF file found (should be the converted one)
    if (pdfFiles[0]) {
      const pdfPath = path.join(outputDir, pdfFiles[0]);
      console.log(`[pageCounter] Found converted PDF: ${pdfPath}`);
      return pdfPath;
    }

    // No PDF found
    await fs.rmdir(outputDir, { recursive: true }).catch(() => { });
    throw new Error('Không tìm thấy file PDF sau khi convert');
  } catch (error) {
    console.error('[pageCounter] Error converting to PDF with LibreOffice:', error);
    if (error instanceof Error) {
      throw error; // Re-throw to propagate error message
    }
    throw new Error('Lỗi không xác định khi chuyển đổi file sang PDF bằng LibreOffice');
  }
}

export async function countDocumentPages(
  filePath: string,
  mimeType: string,
  fileSize: number,
): Promise<number> {
  if (mimeType === 'application/pdf') {
    try {
      // Use createRequire for ESM compatibility
      const { createRequire } = await import('module');
      const __filename = fileURLToPath(import.meta.url);
      const require = createRequire(__filename);
      const pdfParse = require('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      // pdf-parse 1.1.1 exports as a function, but require might return default
      const pdf = await (typeof pdfParse === 'function' ? pdfParse(dataBuffer) : pdfParse.default(dataBuffer));
      console.log(`[pageCounter] PDF parsed: ${pdf.numpages} pages`);
      return pdf.numpages;
    } catch (error) {
      console.error('[pageCounter] Error parsing PDF:', error);
      // Fallback to estimation if PDF parsing fails
      // Estimate: ~50KB per page for PDF (more accurate than 1MB per page)
      const estimated = Math.max(1, Math.ceil(fileSize / (50 * 1024)));
      console.log(`[pageCounter] PDF fallback estimate: ${estimated} pages`);
      return estimated;
    }
  } else if (
    mimeType.includes('wordprocessingml') ||
    mimeType.includes('msword')
  ) {
    // Word documents: Convert to PDF using LibreOffice for accurate page count (REQUIRED)
    try {
      console.log(`[pageCounter] Converting Word document to PDF using LibreOffice: ${filePath}`);
      const convertedPdfPath = await convertToPdfWithLibreOffice(filePath);

      if (!convertedPdfPath) {
        throw new Error('Không thể chuyển đổi file Word sang PDF. LibreOffice không tạo được file PDF.');
      }

      // Count pages from converted PDF using pdf-parse (version 1.1.1)
      // Use createRequire for ESM compatibility
      const { createRequire } = await import('module');
      const __filename = fileURLToPath(import.meta.url);
      const require = createRequire(__filename);
      const pdfParse = require('pdf-parse');
      const pdfBuffer = await fs.readFile(convertedPdfPath);
      // pdf-parse 1.1.1 exports as a function, but require might return default
      const pdf = await (typeof pdfParse === 'function' ? pdfParse(pdfBuffer) : pdfParse.default(pdfBuffer));
      const pageCount = pdf.numpages;

      // Clean up temporary PDF file and directory
      const pdfDir = path.dirname(convertedPdfPath);
      await fs.unlink(convertedPdfPath).catch(() => { });
      await fs.rmdir(pdfDir).catch(() => { });

      console.log(`[pageCounter] Word document converted to PDF and counted: ${pageCount} pages (accurate)`);
      return pageCount;
    } catch (error) {
      console.error('[pageCounter] Error converting Word to PDF:', error);
      if (error instanceof Error) {
        throw new Error(`Không thể đếm số trang file Word: ${error.message}`);
      }
      throw error;
    }
  } else if (
    mimeType.includes('presentationml') ||
    mimeType.includes('mspowerpoint')
  ) {
    // PowerPoint: Convert to PDF using LibreOffice for accurate slide count (REQUIRED)
    try {
      console.log(`[pageCounter] Converting PowerPoint to PDF using LibreOffice: ${filePath}`);
      const convertedPdfPath = await convertToPdfWithLibreOffice(filePath);

      if (!convertedPdfPath) {
        throw new Error('Không thể chuyển đổi file PowerPoint sang PDF. LibreOffice không tạo được file PDF.');
      }

      // Count pages from converted PDF using pdf-parse (version 1.1.1) (each slide = 1 page)
      // Use createRequire for ESM compatibility
      const { createRequire } = await import('module');
      const __filename = fileURLToPath(import.meta.url);
      const require = createRequire(__filename);
      const pdfParse = require('pdf-parse');
      const pdfBuffer = await fs.readFile(convertedPdfPath);
      // pdf-parse 1.1.1 exports as a function, but require might return default
      const pdf = await (typeof pdfParse === 'function' ? pdfParse(pdfBuffer) : pdfParse.default(pdfBuffer));
      const slideCount = pdf.numpages;

      // Clean up temporary PDF file and directory
      const pdfDir = path.dirname(convertedPdfPath);
      await fs.unlink(convertedPdfPath).catch(() => { });
      await fs.rmdir(pdfDir).catch(() => { });

      console.log(`[pageCounter] PowerPoint converted to PDF and counted: ${slideCount} slides (accurate)`);
      return slideCount;
    } catch (error) {
      console.error('[pageCounter] Error converting PowerPoint to PDF:', error);
      if (error instanceof Error) {
        throw new Error(`Không thể đếm số trang file PowerPoint: ${error.message}`);
      }
      throw error;
    }
  } else if (
    mimeType.includes('spreadsheetml') ||
    mimeType.includes('ms-excel')
  ) {
    // Excel: Estimate based on typical sheet size
    // Average Excel sheet printed: ~50KB per printed page
    const estimated = Math.max(1, Math.ceil(fileSize / (50 * 1024)));
    console.log(`[pageCounter] Excel estimate: ${estimated} pages (${fileSize} bytes)`);
    return estimated;
  } else if (mimeType.includes('text/plain')) {
    // Text files: Estimate based on typical text page
    // Average text page: ~2KB (assuming ~500 words per page)
    const estimated = Math.max(1, Math.ceil(fileSize / (2 * 1024)));
    console.log(`[pageCounter] Text file estimate: ${estimated} pages (${fileSize} bytes)`);
    return estimated;
  } else {
    // Fallback for unknown types: conservative estimate
    const estimated = Math.max(1, Math.ceil(fileSize / (100 * 1024))); // 100KB per page
    console.log(`[pageCounter] Unknown type estimate: ${estimated} pages (${fileSize} bytes)`);
    return estimated;
  }
}

