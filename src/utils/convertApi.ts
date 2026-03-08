/**
 * ConvertAPI Service
 * Sử dụng ConvertAPI để convert DOCX/PPTX sang PDF
 * Fallback về LibreOffice nếu ConvertAPI không available
 */

import fs from 'fs/promises';
import path from 'path';
import FormData from 'form-data';
import { convertToPdfWithLibreOffice } from './pageCounter.js';

const CONVERT_API_KEY = process.env.CONVERT_API_KEY;

/**
 * Convert DOCX/PPTX to PDF using ConvertAPI
 * @param filePath - Path to the source file
 * @param fileType - File type (docx, pptx, etc.)
 * @returns Path to converted PDF file or null if failed
 */
export async function convertToPdfWithConvertAPI(
  filePath: string,
  fileType: 'docx' | 'pptx' | 'doc' | 'ppt'
): Promise<string | null> {
  // Check if ConvertAPI key is configured
  if (!CONVERT_API_KEY) {
    console.log('[ConvertAPI] API key not configured, falling back to LibreOffice');
    return null;
  }

  try {
    console.log(`[ConvertAPI] Converting ${fileType} to PDF: ${filePath}`);

    // Read file
    const fileBuffer = await fs.readFile(filePath);

    // Create form data for ConvertAPI v2
    const formData = new FormData();
    formData.append('File', fileBuffer, {
      filename: path.basename(filePath),
      contentType: fileType === 'docx' || fileType === 'doc'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });

    // ConvertAPI v2 endpoint format: https://v2.convertapi.com/convert/{from}/{to}
    const fromFormat = fileType === 'docx' ? 'docx' : fileType === 'doc' ? 'doc' : fileType === 'pptx' ? 'pptx' : 'ppt';
    const apiUrl = `https://v2.convertapi.com/convert/${fromFormat}/to/pdf`;

    // Call ConvertAPI with Secret in query param or header
    const response = await fetch(`${apiUrl}?Secret=${CONVERT_API_KEY}`, {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders(),
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[ConvertAPI] API error: ${response.status} - ${errorText}`);
      throw new Error(`ConvertAPI error: ${response.status}`);
    }

    // ConvertAPI returns JSON với trường Files
    const result = (await response.json()) as { Files?: Array<{ Url: string }> };
    
    if (!result.Files || !result.Files[0] || !result.Files[0].Url) {
      console.error('[ConvertAPI] Invalid response format:', result);
      throw new Error('ConvertAPI returned invalid response');
    }

    // Download PDF from URL
    const pdfUrl = result.Files[0].Url;
    const pdfResponse = await fetch(pdfUrl);
    
    if (!pdfResponse.ok) {
      throw new Error(`Failed to download PDF from ConvertAPI: ${pdfResponse.status}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    // Save PDF to temporary file
    const outputDir = path.join(path.dirname(filePath), 'temp_pdf_' + Date.now());
    await fs.mkdir(outputDir, { recursive: true });
    
    const pdfPath = path.join(outputDir, path.basename(filePath, path.extname(filePath)) + '.pdf');
    await fs.writeFile(pdfPath, Buffer.from(pdfBuffer));

    console.log(`[ConvertAPI] Successfully converted to PDF: ${pdfPath}`);
    return pdfPath;
  } catch (error) {
    console.error('[ConvertAPI] Error converting with ConvertAPI:', error);
    // Return null to trigger fallback
    return null;
  }
}

/**
 * Convert document to PDF with fallback strategy:
 * 1. Try ConvertAPI first (if configured)
 * 2. Fallback to LibreOffice
 * 3. If both fail, throw error
 */
export async function convertToPdfWithFallback(
  filePath: string,
  mimeType: string
): Promise<string> {
  const fileExt = path.extname(filePath).toLowerCase();
  
  // Determine file type
  let fileType: 'docx' | 'pptx' | 'doc' | 'ppt' | null = null;
  if (fileExt === '.docx' || mimeType.includes('wordprocessingml')) {
    fileType = 'docx';
  } else if (fileExt === '.doc' || mimeType.includes('msword')) {
    fileType = 'doc';
  } else if (fileExt === '.pptx' || mimeType.includes('presentationml')) {
    fileType = 'pptx';
  } else if (fileExt === '.ppt' || mimeType.includes('mspowerpoint')) {
    fileType = 'ppt';
  }

  // Try ConvertAPI first (if file type is supported and API key is configured)
  if (fileType && CONVERT_API_KEY) {
    try {
      const pdfPath = await convertToPdfWithConvertAPI(filePath, fileType);
      if (pdfPath) {
        return pdfPath;
      }
    } catch (error) {
      console.warn('[ConvertAPI] ConvertAPI failed, trying LibreOffice:', error);
    }
  }

  // Fallback to LibreOffice
  const pdfPath = await convertToPdfWithLibreOffice(filePath);
  if (!pdfPath) {
    throw new Error('Không thể convert file sang PDF. Vui lòng kiểm tra cấu hình ConvertAPI hoặc cài đặt LibreOffice.');
  }

  return pdfPath;
}

