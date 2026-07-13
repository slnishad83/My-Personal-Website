import Capacitor
import CallKit
import AVFoundation

@objc(IncomingCallPlugin)
public class IncomingCallPlugin: CAPPlugin, CXProviderDelegate {
    private var provider: CXProvider?
    private var callController: CXCallController?
    private var currentCallUUID: UUID?
    private var audioSession: AVAudioSession?

    override public func load() {
        super.load()
        setupCallKit()
    }

    private func setupCallKit() {
        let config = CXProviderConfiguration(
            localizedName: "NSL Chat",
            ringtoneSoundName: "default",
            includesCallsInRecents: true
        )
        config.supportsVideo = true
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1

        provider = CXProvider(configuration: config)
        provider?.setDelegate(self, queue: nil)

        callController = CXCallController()
    }

    @objc func reportIncomingCall(_ call: CAPPluginCall) {
        guard let callId = call.getString("callId"),
              let callerName = call.getString("callerName"),
              let callType = call.getString("callType") else {
            call.reject("Missing required parameters: callId, callerName, callType")
            return
        }

        let uuid = UUID()
        currentCallUUID = uuid

        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: callerName)
        update.hasVideo = (callType == "video")
        update.localizedCallerName = callerName
        update.supportsGrouping = false
        update.supportsDTMF = false

        provider?.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
            if let error = error {
                call.reject("Failed to report incoming call: \(error.localizedDescription)")
                return
            }

            self?.configureAudioSession(isVideo: callType == "video")
            call.resolve(["callId": callId, "uuid": uuid.uuidString])
        }
    }

    @objc func endCall(_ call: CAPPluginCall) {
        guard let uuid = currentCallUUID else {
            call.reject("No active call")
            return
        }

        let endAction = CXEndCallAction(call: uuid)
        let transaction = CXTransaction(action: endAction)
        callController?.request(transaction) { [weak self] error in
            if let error = error {
                call.reject("Failed to end call: \(error.localizedDescription)")
                return
            }
            self?.cleanupAudioSession()
            call.resolve(["ended": true])
        }
    }

    @objc func answerCall(_ call: CAPPluginCall) {
        guard let uuid = currentCallUUID else {
            call.reject("No active call")
            return
        }

        let answerAction = CXAnswerCallAction(call: uuid)
        let transaction = CXTransaction(action: answerAction)
        callController?.request(transaction) { error in
            if let error = error {
                call.reject("Failed to answer call: \(error.localizedDescription)")
                return
            }
            call.resolve(["answered": true])
        }
    }

    @objc func setAudioOutput(_ call: CAPPluginCall) {
        guard let output = call.getString("output") else {
            call.reject("Missing output parameter (speaker/earpiece/bluetooth)")
            return
        }

        let session = AVAudioSession.sharedInstance()
        do {
            switch output {
            case "speaker":
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker])
            case "earpiece":
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: [])
            case "bluetooth":
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP])
            default:
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker])
            }
            try session.setActive(true)
            call.resolve(["output": output])
        } catch {
            call.reject("Failed to set audio output: \(error.localizedDescription)")
        }
    }

    private func configureAudioSession(isVideo: Bool) {
        let session = AVAudioSession.sharedInstance()
        do {
            if isVideo {
                try session.setCategory(.playAndRecord, mode: .videoChat, options: [.allowBluetooth, .defaultToSpeaker])
            } else {
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth])
            }
            try session.setActive(true)
            audioSession = session
        } catch {
            NSLog("[CallKit] Failed to configure audio session: \(error.localizedDescription)")
        }
    }

    private func cleanupAudioSession() {
        do {
            try audioSession?.setActive(false, options: .notifyOthersOnDeactivation)
        } catch {
            NSLog("[CallKit] Failed to deactivate audio session: \(error.localizedDescription)")
        }
        audioSession = nil
        currentCallUUID = nil
    }

    // MARK: - CXProviderDelegate

    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        notifyListeners("callAnswered", data: [
            "callId": currentCallUUID?.uuidString ?? "",
            "action": "answer"
        ])
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        notifyListeners("callEnded", data: [
            "callId": currentCallUUID?.uuidString ?? "",
            "action": "end"
        ])
        cleanupAudioSession()
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        NSLog("[CallKit] Audio session activated")
        notifyListeners("audioActivated", data: [:])
    }

    public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        NSLog("[CallKit] Audio session deactivated")
        notifyListeners("audioDeactivated", data: [:])
    }

    public func providerDidReset(_ provider: CXProvider) {
        NSLog("[CallKit] Provider reset")
        cleanupAudioSession()
    }

    public func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        notifyListeners("callMuted", data: ["muted": action.isMuted])
        action.fulfill()
    }
}
