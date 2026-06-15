import AppKit
import CoreImage
import Foundation
import Vision

let fileManager = FileManager.default
let root = URL(fileURLWithPath: "/Users/apple/Documents/New project555")
let publicDir = root.appendingPathComponent("public/deities", isDirectory: true)
let files = ["guanyin", "caishen", "mazu", "yuelao", "wenchang"]

let ciContext = CIContext(options: nil)

func loadCGImage(from inputURL: URL) throws -> (NSImage, CGImage) {
    let imageData = try Data(contentsOf: inputURL)
    guard let nsImage = NSImage(data: imageData) else {
        throw NSError(domain: "VisionCutout", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to load \(inputURL.lastPathComponent)"])
    }

    var rect = CGRect(origin: .zero, size: nsImage.size)
    guard let cgImage = nsImage.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
        throw NSError(domain: "VisionCutout", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to create CGImage for \(inputURL.lastPathComponent)"])
    }

    return (nsImage, cgImage)
}

func renderTransparentPNG(sourceImage: CIImage, maskImage: CIImage, size: CGSize, outputURL: URL) throws {
    let clearBackground = CIImage(color: .clear).cropped(to: sourceImage.extent)
    let blended = sourceImage.applyingFilter(
        "CIBlendWithAlphaMask",
        parameters: [
            kCIInputBackgroundImageKey: clearBackground,
            kCIInputMaskImageKey: maskImage
        ]
    )

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let pngData = ciContext.pngRepresentation(
        of: blended,
        format: .RGBA8,
        colorSpace: colorSpace,
        options: [:]
    ) else {
        throw NSError(domain: "VisionCutout", code: 5, userInfo: [NSLocalizedDescriptionKey: "Failed to encode PNG for \(outputURL.lastPathComponent)"])
    }

    try pngData.write(to: outputURL)
}

func removeBackgroundWithForegroundMask(from inputURL: URL, to outputURL: URL) throws {
    let (nsImage, cgImage) = try loadCGImage(from: inputURL)
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    guard let observation = request.results?.first else {
        throw NSError(domain: "VisionCutout", code: 3, userInfo: [NSLocalizedDescriptionKey: "No foreground mask for \(inputURL.lastPathComponent)"])
    }

    let instances = observation.allInstances
    let maskPixelBuffer = try observation.generateScaledMaskForImage(forInstances: instances, from: handler)
    let maskImage = CIImage(cvPixelBuffer: maskPixelBuffer)
    let sourceImage = CIImage(cgImage: cgImage)
    try renderTransparentPNG(sourceImage: sourceImage, maskImage: maskImage, size: nsImage.size, outputURL: outputURL)
}

func removeBackgroundWithPersonSegmentation(from inputURL: URL, to outputURL: URL) throws {
    let (nsImage, cgImage) = try loadCGImage(from: inputURL)
    let request = VNGeneratePersonSegmentationRequest()
    request.qualityLevel = .accurate
    request.outputPixelFormat = kCVPixelFormatType_OneComponent8
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    guard let maskPixelBuffer = request.results?.first?.pixelBuffer else {
        throw NSError(domain: "VisionCutout", code: 6, userInfo: [NSLocalizedDescriptionKey: "No person mask for \(inputURL.lastPathComponent)"])
    }

    let maskImage = CIImage(cvPixelBuffer: maskPixelBuffer)
    let sourceImage = CIImage(cgImage: cgImage)
    try renderTransparentPNG(sourceImage: sourceImage, maskImage: maskImage, size: nsImage.size, outputURL: outputURL)
}

for name in files {
    let fileURL = publicDir.appendingPathComponent("\(name).png")
    do {
        try removeBackgroundWithForegroundMask(from: fileURL, to: fileURL)
    } catch {
        try removeBackgroundWithPersonSegmentation(from: fileURL, to: fileURL)
    }
    print("Processed \(fileURL.path)")
}
