const fs = require('fs');
const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');

async function generateQRPDF(qrCodeText) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const qrImageBuffer = await QRCode.toBuffer(qrCodeText);
    const qrImage = await pdfDoc.embedPng(qrImageBuffer);
    const qrImageDims = qrImage.scale(1);
    const x = (page.getWidth() - qrImageDims.width) / 2;
    const y = (page.getHeight() - qrImageDims.height) / 2;
    page.drawImage(qrImage, {
        x: x,
        y: y,
        width: qrImageDims.width,
        height: qrImageDims.height,
    });
    const pdfBytes = await pdfDoc.save();
    const pdfFilePath = './qr_code.pdf';
    fs.writeFileSync(pdfFilePath, pdfBytes);
    console.log("PDF avec QR code généré avec succès :", pdfFilePath);

    return pdfFilePath;
}

module.exports = generateQRPDF;