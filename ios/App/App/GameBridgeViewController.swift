import AVFoundation
import Capacitor
import UIKit
import WebKit

class GameBridgeViewController: CAPBridgeViewController {
    private var audioInterruptionObserver: NSObjectProtocol?

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        configureAudioSession()
        hardenGameWebView()
        bridge?.registerPluginInstance(DeviceThermalPlugin())
        bridge?.registerPluginInstance(IosGameNativePlugin())
    }

    deinit {
        if let observer = audioInterruptionObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    private func configureAudioSession() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try? session.setActive(true)

        audioInterruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: session,
            queue: .main
        ) { _ in
            try? AVAudioSession.sharedInstance().setActive(true)
        }
    }

    private func hardenGameWebView() {
        let darkCafe = UIColor(red: 18.0 / 255.0, green: 13.0 / 255.0, blue: 10.0 / 255.0, alpha: 1.0)
        view.backgroundColor = darkCafe
        guard let webView else { return }
        webView.isOpaque = true
        webView.backgroundColor = darkCafe
        webView.allowsLinkPreview = false
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.backgroundColor = darkCafe
    }
}
