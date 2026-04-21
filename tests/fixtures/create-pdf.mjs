import { writeFileSync } from "fs";

const resumeText =
  "John Doe Senior Software Engineer Five years experience in TypeScript React Nodejs Python SQL Docker Kubernetes AWS. Education Bachelor of Science Computer Science. Strong communication and teamwork skills.";

const contentStream = `BT /F1 10 Tf 72 720 Td (${resumeText}) Tj ET`;
const streamLen = Buffer.byteLength(contentStream, "ascii");

const obj1 = "1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n";
const obj2 = "2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n";
const obj3 =
  "3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>>\nendobj\n";
const obj4 = `4 0 obj\n<</Length ${streamLen}>>\nstream\n${contentStream}\nendstream\nendobj\n`;
const obj5 =
  "5 0 obj\n<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>\nendobj\n";

const header = "%PDF-1.4\n";
let pos = header.length;
const offsets = [];
offsets.push(pos);
pos += Buffer.byteLength(obj1, "ascii");
offsets.push(pos);
pos += Buffer.byteLength(obj2, "ascii");
offsets.push(pos);
pos += Buffer.byteLength(obj3, "ascii");
offsets.push(pos);
pos += Buffer.byteLength(obj4, "ascii");
offsets.push(pos);
pos += Buffer.byteLength(obj5, "ascii");

const xrefOffset = pos;
const xrefEntries = offsets
  .map((o) => o.toString().padStart(10, "0") + " 00000 n ")
  .join("\n");
const xref = `xref\n0 6\n0000000000 65535 f \n${xrefEntries}\n`;
const trailer = `trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

const pdf = header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer;
writeFileSync("tests/fixtures/test-resume.pdf", pdf, "ascii");
console.log("PDF created:", pdf.length, "bytes, text length:", resumeText.length);
