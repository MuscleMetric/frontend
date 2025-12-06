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
  @Environment(\.colorScheme) private var colorScheme

  // MARK: - Body

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      // Brand at the top
      Text("MuscleMetric")
        .font(.headline)
        .fontWeight(.bold)
        .foregroundColor(Color(hex: attributes.titleColor ?? "#0B6AA9"))
        .frame(maxWidth: .infinity, alignment: .center)

      let lines = (contentState.subtitle ?? "").components(separatedBy: "\n")

      // TIMER + TEXT SIDE BY SIDE
      HStack(alignment: .center, spacing: 16) {

        // TIMER ON THE LEFT
        if let ms = contentState.timerEndDateInMilliseconds {
          let endDate = Date(timeIntervalSince1970: ms / 1000)
          let startDate = endDate.addingTimeInterval(-90 * 60)

          Text(
            timerInterval: startDate ... endDate,
            pauseTime: nil,
            countsDown: false,
            showsHours: true
          )
          .monospacedDigit()
          .font(.system(size: 44, weight: .bold))   // big but not crazy
          .foregroundColor(.white)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        }

        // WORKOUT INFO ON THE RIGHT
        VStack(alignment: .leading, spacing: 2) {
          if let workoutName = line(0, from: lines) {
            Text(workoutName)
              .font(.title3)
              .fontWeight(.semibold)
              .modifier(
                ConditionalForegroundViewModifier(color: attributes.subtitleColor)
              )
          }

          if let exerciseName = line(1, from: lines) {
            Text(exerciseName)
              .font(.title3)
              .modifier(
                ConditionalForegroundViewModifier(color: attributes.subtitleColor)
              )
          }

          if let setInfo = line(2, from: lines) {
            Text(setInfo)
              .font(.title3)
              .modifier(
                ConditionalForegroundViewModifier(color: attributes.subtitleColor)
              )
          }

          if let lastInfo = line(3, from: lines) {
            Text(lastInfo)
              .font(.title3)
              .modifier(
                ConditionalForegroundViewModifier(color: attributes.subtitleColor)
              )
          }
        }

        Spacer(minLength: 0) // keeps equal padding to the right
      }
    }
    .padding(paddingInsets(from: attributes)) // handles left/right padding
    .activityBackgroundTint(activityBackgroundTint(from: attributes))
    .activitySystemActionForegroundColor(systemActionColor(from: attributes))
  }

  // MARK: - Helpers

  private func line(_ index: Int, from lines: [String]) -> String? {
    guard index < lines.count else { return nil }
    let trimmed = lines[index].trimmingCharacters(in: .whitespacesAndNewlines)
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

    return EdgeInsets(top: 24, leading: 16, bottom: 24, trailing: 16)
  }

  private func activityBackgroundTint(from attributes: LiveActivityAttributes) -> Color {
    if let hex = attributes.backgroundColor {
      return Color(hex: hex)
    }

    // Fallback: adapt to light/dark
    return colorScheme == .dark
      ? Color.black.opacity(0.85)
      : Color.white.opacity(0.9)
  }

  private func systemActionColor(from attributes: LiveActivityAttributes) -> Color {
    if let hex = attributes.titleColor {
      return Color(hex: hex)
    }

    return colorScheme == .dark ? .white : .black
  }
}

#endif
