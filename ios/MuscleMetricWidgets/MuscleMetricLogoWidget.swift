import WidgetKit
import SwiftUI

struct MuscleMetricLogoWidget: Widget {
    let kind: String = "MuscleMetricLogoWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind,
                            provider: LogoProvider()) { entry in
            LogoWidgetView(entry: entry)
                .widgetURL(URL(string: "musclemetric:")!)
        }
        .configurationDisplayName("MuscleMetric")
        .description("Open MuscleMetric from your Lock Screen.")
        .supportedFamilies([.accessoryCircular])
    }
}
