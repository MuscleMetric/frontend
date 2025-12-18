import SwiftUI
import WidgetKit

struct LogoWidgetView: View {
    var entry: LogoEntry

    var body: some View {
        ZStack {
            Color.clear

Image("WidgetLogo")
  .resizable()
  .renderingMode(.template)     // 👈 critical for lock screen
  .scaledToFit()
  .foregroundStyle(.white)      // lock screen-safe
  .padding(8)

        }
        .containerBackground(.clear, for: .widget)
    }
}
