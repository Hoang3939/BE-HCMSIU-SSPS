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
      let stderrOutput = '';
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
        if (code === 0 || code === null) {
          // Success or process was killed normally
          console.log('[pageCounter] LibreOffice conversion process completed');
          resolve();
        } else {
          console.error('[pageCounter] LibreOffice exited with code:', code);
          console.error('[pageCounter] LibreOffice stderr:', stderrOutput);

          // Provide more helpful error messages
          let errorMessage = `LibreOffice conversion failed with exit code ${code}`;
          if (stderrOutput) {
            // Try to extract meaningful error from stderr
            const errorLines = stderrOutput.split('\n').filter(line =>
              line.trim() &&
              !line.includes('Warning') &&
              !line.includes('Info') &&
              !line.includes('fontconfig')
            );
            if (errorLines.length > 0) {
              errorMessage += `. ${errorLines.slice(0, 3).join(' ')}`;
            } else {
              errorMessage += `. ${stderrOutput.substring(0, 200)}`;
            }
          } else {
            errorMessage += '. Có thể file Word bị lỗi hoặc LibreOffice không thể xử lý file này.';
          }

          reject(new Error(errorMessage));
        }
      });

      libreOfficeProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Wait a bit for LibreOffice to finish writing the PDF file
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Find the converted PDF file
    // LibreOffice may change filename, so list all files in output directory
    const files = await fs.readdir(outputDir);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      console.error('[pageCounter] No PDF file found after LibreOffice conversion');
      console.error('[pageCounter] Output directory:', outputDir);
      console.error('[pageCounter] Output directory contents:', files);
      await fs.rmdir(outputDir, { recursive: true }).catch(() => { });
      throw new Error('LibreOffice không tạo được file PDF. Kiểm tra file input có hợp lệ không.');
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
      const __dirname = dirname(__filename);
      const require = createRequire(__filename);
      const pdfParse = require('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const pdf = await pdfParse(dataBuffer);
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
      const pdf = await pdfParse(pdfBuffer);
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
      const pdf = await pdfParse(pdfBuffer);
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

