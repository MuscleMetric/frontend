import WidgetKit
import SwiftUI

struct LogoEntry: TimelineEntry {
    let date: Date
}

struct LogoProvider: TimelineProvider {
    func placeholder(in context: Context) -> LogoEntry {
        LogoEntry(date: .now)
    }

    func getSnapshot(in context: Context,
                     completion: @escaping (LogoEntry) -> Void) {
        completion(LogoEntry(date: .now))
    }

    func getTimeline(in context: Context,
                     completion: @escaping (Timeline<LogoEntry>) -> Void) {
        let entry = LogoEntry(date: .now)
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
}
