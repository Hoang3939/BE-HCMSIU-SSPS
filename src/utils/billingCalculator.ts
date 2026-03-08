import { parsePageRange } from './pageRangeParser.js';

export function validateAndCalculateCost(
    detectedPageCount: number,
    copies: number,
    paperSize: 'A4' | 'A3',
    side: 'ONE_SIDED' | 'DOUBLE_SIDED',
    pageRange: string | undefined,
    a3ToA4Ratio: number = 2.0,
): number {
    if (detectedPageCount <= 0 || copies <= 0 || a3ToA4Ratio <= 0) {
        throw new Error('Tham số tính toán không hợp lệ');
    }

    let actualPagesToPrint = detectedPageCount;

    if (pageRange && pageRange !== 'all') {
        const parsedPages = parsePageRange(pageRange, detectedPageCount);
        if (parsedPages.length === 0) {
            throw new Error('Phạm vi trang không hợp lệ');
        }
        actualPagesToPrint = parsedPages.length;
    }

    const sizeFactor = paperSize === 'A3' ? a3ToA4Ratio : 1;

    // As per business rule: "TotalCost = (Số trang nội dung cần in) x (Số bản copies) x (Hệ số khổ giấy)"
    // Duplex printing does not reduce the "page units" cost from the balance.
    const totalCost = actualPagesToPrint * copies * sizeFactor;

    return totalCost;
}

