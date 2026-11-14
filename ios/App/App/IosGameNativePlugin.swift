import Capacitor
import CoreHaptics
import Foundation
import StoreKit
import UIKit

@objc(DeviceThermalPlugin)
public class DeviceThermalPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DeviceThermalPlugin"
    public let jsName = "DeviceThermal"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise)
    ]

    private var thermalObserver: NSObjectProtocol?
    private var powerObserver: NSObjectProtocol?

    public override func load() {
        super.load()
        let center = NotificationCenter.default
        thermalObserver = center.addObserver(
            forName: ProcessInfo.thermalStateDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.emitCurrentStatus()
        }
        powerObserver = center.addObserver(
            forName: NSNotification.Name.NSProcessInfoPowerStateDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.emitCurrentStatus()
        }
    }

    deinit {
        if let thermalObserver { NotificationCenter.default.removeObserver(thermalObserver) }
        if let powerObserver { NotificationCenter.default.removeObserver(powerObserver) }
    }

    @objc public func getStatus(_ call: CAPPluginCall) {
        call.resolve([
            "supported": true,
            "status": mappedStatus()
        ])
    }

    private func emitCurrentStatus() {
        notifyListeners("thermalStatus", data: [
            "supported": true,
            "status": mappedStatus()
        ])
    }

    private func mappedStatus() -> Int {
        let state = ProcessInfo.processInfo.thermalState
        var level = 0
        switch state {
        case .nominal:
            level = 0
        case .fair:
            level = 1
        case .serious:
            level = 3
        case .critical:
            level = 4
        @unknown default:
            level = 0
        }
        if ProcessInfo.processInfo.isLowPowerModeEnabled && level < 1 {
            level = 1
        }
        return level
    }
}

@objc(IosGameNativePlugin)
public class IosGameNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IosGameNativePlugin"
    public let jsName = "IosGameNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playTransientHaptic", returnType: CAPPluginReturnPromise)
    ]

    private var hapticEngine: CHHapticEngine?

    @objc public func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            if let windowScene = self?.bridge?.viewController?.view.window?.windowScene
                ?? UIApplication.shared.connectedScenes
                    .compactMap({ $0 as? UIWindowScene })
                    .first(where: { $0.activationState == .foregroundActive })
            {
                SKStoreReviewController.requestReview(in: windowScene)
                call.resolve(["requested": true])
            } else {
                call.resolve(["requested": false])
            }
        }
    }

    @objc public func playTransientHaptic(_ call: CAPPluginCall) {
        let rawIntensity = Float(call.getDouble("intensity") ?? 0.65)
        let rawSharpness = Float(call.getDouble("sharpness") ?? 0.55)
        let intensity = max(0.1, min(1.0, rawIntensity))
        let sharpness = max(0.05, min(1.0, rawSharpness))

        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            call.resolve(["played": false])
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else {
                call.resolve(["played": false])
                return
            }
            do {
                let engine = try self.ensureStartedEngine()
                let event = CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness)
                    ],
                    relativeTime: 0
                )
                let pattern = try CHHapticPattern(events: [event], parameters: [])
                let player = try engine.makePlayer(with: pattern)
                try player.start(atTime: 0)
                call.resolve(["played": true])
            } catch {
                self.hapticEngine = nil
                call.resolve(["played": false])
            }
        }
    }

    private func ensureStartedEngine() throws -> CHHapticEngine {
        if let existing = hapticEngine {
            try existing.start()
            return existing
        }
        let engine = try CHHapticEngine()
        engine.playsHapticsOnly = true
        engine.stoppedHandler = { [weak self] _ in
            self?.hapticEngine = nil
        }
        engine.resetHandler = { [weak self] in
            try? self?.hapticEngine?.start()
        }
        try engine.start()
        hapticEngine = engine
        return engine
    }
}
