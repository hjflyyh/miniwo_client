#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface AppleLoginBridge : NSObject

/// 供 JS 调用的登录方法
+ (void)login;

@end

NS_ASSUME_NONNULL_END
