#import <Capacitor/CAPPlugin.h>

@interface IncomingCallPlugin : CAPPlugin
- (void)reportIncomingCall:(CAPPluginCall *)call;
- (void)endCall:(CAPPluginCall *)call;
- (void)answerCall:(CAPPluginCall *)call;
- (void)setAudioOutput:(CAPPluginCall *)call;
@end

CAP_PLUGIN(IncomingCallPlugin, "IncomingCallPlugin",
    CAP_PLUGIN_METHOD(reportIncomingCall, CAPPluginMethodPromise);
    CAP_PLUGIN_METHOD(endCall, CAPPluginMethodPromise);
    CAP_PLUGIN_METHOD(answerCall, CAPPluginMethodPromise);
    CAP_PLUGIN_METHOD(setAudioOutput, CAPPluginMethodPromise);
)
