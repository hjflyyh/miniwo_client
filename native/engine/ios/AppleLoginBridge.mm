#import "AppleLoginBridge.h"
#import <AuthenticationServices/AuthenticationServices.h>
#import <objc/runtime.h>

// 引入 Cocos 引擎头文件
#include "application/ApplicationManager.h"
#include "cocos/bindings/jswrapper/SeApi.h"

// 遵循代理协议的私有扩展
@interface AppleLoginBridge () <ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding>
@end

@implementation AppleLoginBridge

+ (void)login {
    dispatch_async(dispatch_get_main_queue(), ^{
        AppleLoginBridge *bridge = [[AppleLoginBridge alloc] init];
        
        // 创建 Apple ID 授权请求
        ASAuthorizationAppleIDProvider *provider = [[ASAuthorizationAppleIDProvider alloc] init];
        ASAuthorizationAppleIDRequest *request = [provider createRequest];
        
        // 请求用户信息：全名和邮箱
        request.requestedScopes = @[ASAuthorizationScopeFullName, ASAuthorizationScopeEmail];
        
        // 创建授权控制器
        ASAuthorizationController *controller = [[ASAuthorizationController alloc] initWithAuthorizationRequests:@[request]];
        controller.delegate = bridge;
        controller.presentationContextProvider = bridge;
        
        // 开始授权流程
        [controller performRequests];
        
        // 将 bridge 实例关联到 controller，防止提前释放
        objc_setAssociatedObject(controller, "AppleLoginBridge", bridge, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    });
}

#pragma mark - ASAuthorizationControllerDelegate

- (void)authorizationController:(ASAuthorizationController *)controller
   didCompleteWithAuthorization:(ASAuthorization *)authorization {
    
    if ([authorization.credential isKindOfClass:[ASAuthorizationAppleIDCredential class]]) {
        ASAuthorizationAppleIDCredential *credential = (ASAuthorizationAppleIDCredential *)authorization.credential;
        
        // 获取关键信息
        NSString *userIdentifier = credential.user;  // 用户唯一标识（稳定）
        NSString *identityToken = [[NSString alloc] initWithData:credential.identityToken
                                                        encoding:NSUTF8StringEncoding];  // JWT token
        NSString *authorizationCode = [[NSString alloc] initWithData:credential.authorizationCode
                                                             encoding:NSUTF8StringEncoding];  // 授权码
        
        // 获取用户信息（首次登录时才有）
        NSString *fullName = @"";
        NSString *email = credential.email ?: @"";
        if (credential.fullName) {
            NSPersonNameComponents *nameComponents = credential.fullName;
            if (nameComponents.givenName || nameComponents.familyName) {
                fullName = [NSString stringWithFormat:@"%@%@",
                           nameComponents.givenName ?: @"",
                           nameComponents.familyName ?: @""];
            }
        }
        
        // 组装结果 JSON
        NSDictionary *result = @{
            @"userID": userIdentifier ?: @"",
            @"identityToken": identityToken ?: @"",
            @"authorizationCode": authorizationCode ?: @"",
            @"fullName": fullName,
            @"email": email
        };
        
        NSError *error;
        NSData *jsonData = [NSJSONSerialization dataWithJSONObject:result options:0 error:&error];
        NSString *jsonStr = jsonData ? [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding] : @"{}";
        
        [self sendResultToJS:jsonStr isSuccess:YES];
    }
    
    // 清理关联对象
    objc_setAssociatedObject(controller, "AppleLoginBridge", nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}

- (void)authorizationController:(ASAuthorizationController *)controller
           didCompleteWithError:(NSError *)error {
    
    NSString *errorMsg = error.localizedDescription ?: @"User canceled or unknown error";
    NSDictionary *result = @{@"error": errorMsg};
    
    NSError *jsonError;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:result options:0 error:&jsonError];
    NSString *jsonStr = jsonData ? [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding] : @"{}\"error\":\"login failed\"}";
    
    [self sendResultToJS:jsonStr isSuccess:NO];
    
    // 清理关联对象
    objc_setAssociatedObject(controller, "AppleLoginBridge", nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
}

#pragma mark - ASAuthorizationControllerPresentationContextProviding

- (ASPresentationAnchor)presentationAnchorForAuthorizationController:(ASAuthorizationController *)controller {
    return [UIApplication sharedApplication].keyWindow;
}

#pragma mark - 回调 JS 层

+ (void)sendResultToJS:(NSString *)jsonStr isSuccess:(BOOL)isSuccess {
    // 构建 JS 回调代码
    NSString *jsStr = [NSString stringWithFormat:
        @"window.onAppleLoginResult && window.onAppleLoginResult(%d, '%@');",
        isSuccess ? 1 : 0,
        jsonStr];
    
    // 在主线程执行 JS
    dispatch_async(dispatch_get_main_queue(), ^{
        se::ScriptEngine::getInstance()->evalString([jsStr UTF8String]);
    });
}

// 实例方法包装，调用类方法
- (void)sendResultToJS:(NSString *)jsonStr isSuccess:(BOOL)isSuccess {
    [AppleLoginBridge sendResultToJS:jsonStr isSuccess:isSuccess];
}

@end
