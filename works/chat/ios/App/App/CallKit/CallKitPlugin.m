#import <Capacitor/CAPPlugin.h>

@interface CAPPlugin (CallKit)
- (void)load;
@end

@interface CAPInstancePlugin : CAPPlugin
@end

@implementation CAPInstancePlugin
@end

@interface IncomingCallPlugin : CAPInstancePlugin
- (void)reportIncomingCall:(CAPPluginCall *)call;
- (void)endCall:(CAPPluginCall *)call;
- (void)answerCall:(CAPPluginCall *)call;
- (void)setAudioOutput:(CAPPluginCall *)call;
@end

@implementation IncomingCallPlugin

- (void)reportIncomingCall:(CAPPluginCall *)call {
    // Bridge to Swift implementation
}

- (void)endCall:(CAPPluginCall *)call {
    // Bridge to Swift implementation
}

- (void)answerCall:(CAPPluginCall *)call {
    // Bridge to Swift implementation
}

- (void)setAudioOutput:(CAPPluginCall *)call {
    // Bridge to Swift implementation
}

@end

// Register the plugin
CAP_PLUGIN(IncomingCallPlugin, "IncomingCallPlugin",
    CAP_PLUGIN_METHOD(reportIncomingCall, CAPPluginMethodPromise);
    CAP_PLUGIN_METHOD(endCall, CAPPluginMethodPromise);
    CAP_PLUGIN_METHOD(answerCall, CAPPluginMethodPromise);
    CAP_PLUGIN_METHOD(setAudioOutput, CAPPluginMethodPromise);
)
