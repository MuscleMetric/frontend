import WidgetKit
import SwiftUI

struct LogoEntry: TimelineEntry { let date: Date }

struct LogoProvider: TimelineProvider {
  func placeholder(in context: Context) -> LogoEntry { .init(date: .now) }
  func getSnapshot(in context: Context, completion: @escaping (LogoEntry) -> Void) { completion(.init(date: .now)) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<LogoEntry>) -> Void) {
    completion(Timeline(entries: [.init(date: .now)], policy: .never))
  }
}

struct LogoWidgetView: View {
  var entry: LogoEntry
  var body: some View {
    ZStack {
      Circle().fill(Color.black.opacity(0.35))
      Text("MM")
        .font(.system(size: 18, weight: .heavy, design: .rounded))
        .foregroundStyle(.white)
    }
    .widgetURL(URL(string: "musclemetric://"))
    .containerBackground(.clear, for: .widget)
  }
}

struct MuscleMetricLogoWidget: Widget {
  let kind = "MuscleMetricLogoWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: LogoProvider()) { entry in
      LogoWidgetView(entry: entry)
    }
    .configurationDisplayName("MuscleMetric")
    .description("Open MuscleMetric.")
    #if os(iOS)
    .supportedFamilies([.accessoryCircular])
    #endif
  }
}
