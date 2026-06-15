#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface ImagePickerHelper : NSObject <UIImagePickerControllerDelegate, UINavigationControllerDelegate>

+ (instancetype)sharedHelper;

/** JS: native.reflection.callStaticMethod('ImagePickerHelper', 'selectPhoto'); */
+ (void)selectPhoto;

@end

NS_ASSUME_NONNULL_END
