import SwiftUI
import WidgetKit

#if canImport(ActivityKit)

struct ConditionalForegroundViewModifier: ViewModifier {
  let color: String?

  func body(content: Content) -> some View {
    if let color = color {
      content.foregroundStyle(Color(hex: color))
    } else {
      content
    }
  }
}

struct DebugLog: View {
  #if DEBUG
    private let message: String
    init(_ message: String) {
      self.message = message
      print(message)
    }

    var body: some View {
      Text(message)
        .font(.caption2)
        .foregroundStyle(.red)
    }
  #else
    init(_: String) {}
    var body: some View { EmptyView() }
  #endif
}

struct LiveActivityView: View {
  let contentState: LiveActivityAttributes.ContentState
  let attributes: LiveActivityAttributes
  @State private var imageContainerSize: CGSize?
  @Environment(\.colorScheme) private var colorScheme

  var progressViewTint: Color? {
    attributes.progressViewTint.map { Color(hex: $0) }
  }

  private var imageAlignment: Alignment {
    switch attributes.imageAlign {
    case "center":
      return .center
    case "bottom":
      return .bottom
    default:
      return .top
    }
  }

  private func alignedImage(imageName: String) -> some View {
    let defaultHeight: CGFloat = 64
    let defaultWidth: CGFloat = 64
    let containerHeight = imageContainerSize?.height
    let containerWidth = imageContainerSize?.width
    let hasWidthConstraint = (attributes.imageWidthPercent != nil) || (attributes.imageWidth != nil)

    let computedHeight: CGFloat? = {
      if let percent = attributes.imageHeightPercent {
        let clamped = min(max(percent, 0), 100) / 100.0
        let base = (containerHeight ?? defaultHeight)
        return base * clamped
      } else if let size = attributes.imageHeight {
        return CGFloat(size)
      } else if hasWidthConstraint {
        // height automatic to preserve aspect ratio
        return nil
      } else {
        // default size
        return defaultHeight
      }
    }()

    let computedWidth: CGFloat? = {
      if let percent = attributes.imageWidthPercent {
        let clamped = min(max(percent, 0), 100) / 100.0
        let base = (containerWidth ?? defaultWidth)
        return base * clamped
      } else if let size = attributes.imageWidth {
        return CGFloat(size)
      } else {
        // width automatic, based on height / aspect ratio
        return nil
      }
    }()

    return ZStack(alignment: .center) {
      Group {
        let fit = attributes.contentFit ?? "cover"
        switch fit {
        case "contain":
          Image.dynamic(assetNameOrPath: imageName)
            .resizable()
            .scaledToFit()
            .frame(width: computedWidth, height: computedHeight)

        case "fill":
          Image.dynamic(assetNameOrPath: imageName)
            .resizable()
            .frame(width: computedWidth, height: computedHeight)

        case "none":
          Image.dynamic(assetNameOrPath: imageName)
            .renderingMode(.original)
            .frame(width: computedWidth, height: computedHeight)

        case "scale-down":
          if let uiImage = UIImage.dynamic(assetNameOrPath: imageName) {
            let targetHeight = computedHeight ?? uiImage.size.height
            let targetWidth = computedWidth ?? uiImage.size.width
            let shouldScaleDown = uiImage.size.height > targetHeight || uiImage.size.width > targetWidth

            if shouldScaleDown {
              Image(uiImage: uiImage)
                .resizable()
                .scaledToFit()
                .frame(width: computedWidth, height: computedHeight)
            } else {
              Image(uiImage: uiImage)
                .renderingMode(.original)
                .frame(
                  width: min(uiImage.size.width, targetWidth),
                  height: min(uiImage.size.height, targetHeight)
                )
            }
          } else {
            DebugLog("⚠️[ExpoLiveActivity] assetNameOrPath couldn't resolve to UIImage")
          }

        case "cover":
          Image.dynamic(assetNameOrPath: imageName)
            .resizable()
            .scaledToFill()
            .frame(width: computedWidth, height: computedHeight)
            .clipped()

        default:
          DebugLog("⚠️[ExpoLiveActivity] Unknown contentFit '\(fit)'")
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: imageAlignment)
    .background(
      GeometryReader { proxy in
        Color.clear
          .onAppear {
            let s = proxy.size
            if s.width > 0, s.height > 0 { imageContainerSize = s }
          }
          .onChange(of: proxy.size) { s in
            if s.width > 0, s.height > 0 { imageContainerSize = s }
          }
      }
    )
  }

  // MARK: - Main Layout

  var body: some View {
    VStack(alignment: .leading) {
      // Split subtitle into up to 4 lines:
      // 0: workout name
      // 1: exercise name
      // 2: set info
      // 3: last set info
      let lines = (contentState.subtitle ?? "").components(separatedBy: "\n")

      HStack(alignment: .center, spacing: 12) {
        // LEFT COLUMN: logo at the top, timer at the bottom
        if let imageName = contentState.imageName {
          VStack(alignment: .leading) {
            // Logo top-left
            alignedImage(imageName: imageName)

            Spacer(minLength: 0)

            // Timer bottom-left (ActivityKit-driven timer)
            if let ms = contentState.timerEndDateInMilliseconds {
              Text(
                timerInterval: Date.toTimerInterval(miliseconds: ms),
                pauseTime: nil,
                countsDown: false,
                showsHours: true
              )
              .monospacedDigit()
              .font(.title2)
              .fontWeight(.bold)
              .modifier(
                ConditionalForegroundViewModifier(
                  color: attributes.titleColor
                )
              )
            }
          }
          .frame(maxHeight: .infinity, alignment: .topLeading)
        }

        // RIGHT COLUMN: 4 rows of text
        VStack(alignment: .leading, spacing: 2) {
          if let workoutName = line(0, from: lines) {
            Text(workoutName) // Workout name
              .font(.title3)
              .fontWeight(.semibold)
              .modifier(
                ConditionalForegroundViewModifier(
                  color: attributes.subtitleColor
                )
              )
          }

          if let exerciseName = line(1, from: lines) {
            Text(exerciseName) // Exercise name
              .font(.title3)
              .modifier(
                ConditionalForegroundViewModifier(
                  color: attributes.subtitleColor
                )
              )
          }

          if let setInfo = line(2, from: lines) {
            Text(setInfo) // Set info (e.g. "Set 2 of 2")
              .font(.title3)
              .modifier(
                ConditionalForegroundViewModifier(
                  color: attributes.subtitleColor
                )
              )
          }

          if let lastInfo = line(3, from: lines) {
            Text(lastInfo) // Last set info (e.g. "Last: 5×100kg")
              .font(.title3)
              .modifier(
                ConditionalForegroundViewModifier(
                  color: attributes.subtitleColor
                )
              )
          }
        }
        .layoutPriority(1)
      }
    }
    .padding(paddingInsets(from: attributes))
    .activityBackgroundTint(activityBackgroundTint(from: attributes))
    .activitySystemActionForegroundColor(systemActionColor(from: attributes))
  }

  // MARK: - Helpers

  private func line(_ index: Int, from lines: [String]) -> String? {
    guard index < lines.count else { return nil }
    let trimmed = lines[index].trimmingCharacters(
      in: .whitespacesAndNewlines
    )
    return trimmed.isEmpty ? nil : trimmed
  }

  private func paddingInsets(from attributes: LiveActivityAttributes) -> EdgeInsets {
    if let padding = attributes.padding {
      return EdgeInsets(
        top: CGFloat(padding),
        leading: CGFloat(padding),
        bottom: CGFloat(padding),
        trailing: CGFloat(padding)
      )
    }

    if let details = attributes.paddingDetails {
      let top = CGFloat(details.top ?? 0)
      let bottom = CGFloat(details.bottom ?? 0)
      let horizontal = CGFloat(details.horizontal ?? 0)
      return EdgeInsets(
        top: top,
        leading: horizontal,
        bottom: bottom,
        trailing: horizontal
      )
    }

    // default padding
    return EdgeInsets(top: 24, leading: 16, bottom: 24, trailing: 16)
  }

  private func activityBackgroundTint(from attributes: LiveActivityAttributes) -> Color {
    if let hex = attributes.backgroundColor {
      return Color(hex: hex)
    }

    // Fallback: adapt to system light/dark
    return colorScheme == .dark
      ? Color.black.opacity(0.85)
      : Color.white.opacity(0.9)
  }

  private func systemActionColor(from attributes: LiveActivityAttributes) -> Color {
    if let hex = attributes.titleColor {
      return Color(hex: hex)
    }

    // Fallback: readable against the background
    return colorScheme == .dark ? .white : .black
  }
}

#endif
