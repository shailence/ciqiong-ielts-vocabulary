import Foundation
import Vision
import PDFKit
import AppKit

struct Observation: Codable {
    let text: String
    let confidence: Float
    let x: CGFloat
    let y: CGFloat
    let width: CGFloat
    let height: CGFloat
}

guard CommandLine.arguments.count >= 4 else {
    fputs("usage: ocr-book.swift PDF OUTPUT_DIR PAGE_OR_RANGE...\n", stderr)
    exit(2)
}

let source = CommandLine.arguments[1]
let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
guard let document = PDFDocument(url: URL(fileURLWithPath: source)) else {
    fputs("cannot open PDF\n", stderr)
    exit(1)
}

try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)

func pageNumbers(_ values: ArraySlice<String>) -> [Int] {
    var result = Set<Int>()
    for value in values {
        let parts = value.split(separator: "-", maxSplits: 1).compactMap { Int($0) }
        if parts.count == 2 {
            for number in min(parts[0], parts[1])...max(parts[0], parts[1]) { result.insert(number) }
        } else if let number = parts.first { result.insert(number) }
    }
    return result.sorted()
}

func render(_ page: PDFPage, scale: CGFloat = 2.8) -> CGImage? {
    let bounds = page.bounds(for: .mediaBox)
    let rawWidth = Int(ceil(bounds.width * scale))
    let rawHeight = Int(ceil(bounds.height * scale))
    let width = ((rawWidth + 63) / 64) * 64
    let height = ((rawHeight + 63) / 64) * 64
    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { return nil }
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.scaleBy(x: CGFloat(width) / bounds.width, y: CGFloat(height) / bounds.height)
    page.draw(with: .mediaBox, to: context)
    return context.makeImage()
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.withoutEscapingSlashes]

for number in pageNumbers(CommandLine.arguments.dropFirst(3)) {
    let index = number - 1
    guard index >= 0, index < document.pageCount, let page = document.page(at: index), let image = render(page) else {
        fputs("skip page \(number)\n", stderr)
        continue
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US", "zh-Hans"]
    request.usesLanguageCorrection = true
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    let observations = (request.results ?? []).compactMap { item -> Observation? in
        guard let candidate = item.topCandidates(1).first else { return nil }
        let box = item.boundingBox
        return Observation(text: candidate.string, confidence: candidate.confidence,
                           x: box.origin.x, y: box.origin.y, width: box.width, height: box.height)
    }
    let destination = outputDirectory.appendingPathComponent(String(format: "page-%03d.json", number))
    try encoder.encode(observations).write(to: destination)
    print("page \(number): \(observations.count) lines")
}
