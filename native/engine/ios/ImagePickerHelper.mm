#import "ImagePickerHelper.h"

#import <UIKit/UIKit.h>

#include "../common/Classes/NativeImagePickerBridge.h"

static const CGFloat kImagePickerMaxSide = 2048.0;
static const CGFloat kImagePickerJpegQuality = 0.85;

static UIViewController *TopViewController(UIViewController *root) {
    if (!root) {
        return nil;
    }
    UIViewController *vc = root;
    while (vc.presentedViewController) {
        vc = vc.presentedViewController;
    }
    return vc;
}

static UIImage *ResizeImageIfNeeded(UIImage *image, CGFloat maxSide) {
    if (!image || maxSide <= 0) {
        return image;
    }
    const CGFloat width = image.size.width;
    const CGFloat height = image.size.height;
    const CGFloat longest = MAX(width, height);
    if (longest <= maxSide) {
        return image;
    }
    const CGFloat scale = maxSide / longest;
    const CGSize newSize = CGSizeMake(floor(width * scale), floor(height * scale));
    UIGraphicsBeginImageContextWithOptions(newSize, NO, 1.0);
    [image drawInRect:CGRectMake(0, 0, newSize.width, newSize.height)];
    UIImage *resized = UIGraphicsGetImageFromCurrentImageContext();
    UIGraphicsEndImageContext();
    return resized ?: image;
}

static NSString *DataUrlFromImage(UIImage *image) {
    UIImage *normalized = ResizeImageIfNeeded(image, kImagePickerMaxSide);
    NSData *jpegData = UIImageJPEGRepresentation(normalized, kImagePickerJpegQuality);
    if (!jpegData || jpegData.length == 0) {
        return nil;
    }
    NSString *base64 = [jpegData base64EncodedStringWithOptions:0];
    if (!base64) {
        return nil;
    }
    return [NSString stringWithFormat:@"data:image/jpeg;base64,%@", base64];
}

@implementation ImagePickerHelper

+ (instancetype)sharedHelper {
    static ImagePickerHelper *helper = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        helper = [[ImagePickerHelper alloc] init];
    });
    return helper;
}

+ (void)selectPhoto {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (![UIImagePickerController isSourceTypeAvailable:UIImagePickerControllerSourceTypePhotoLibrary]) {
            NSLog(@"[ImagePickerHelper] photo library unavailable");
            NativeImagePickerBridge_notifyImageSelected("");
            return;
        }

        UIViewController *presenter =
            TopViewController([UIApplication sharedApplication].keyWindow.rootViewController);
        if (!presenter) {
            NSLog(@"[ImagePickerHelper] no root view controller");
            NativeImagePickerBridge_notifyImageSelected("");
            return;
        }

        UIImagePickerController *picker = [[UIImagePickerController alloc] init];
        picker.sourceType = UIImagePickerControllerSourceTypePhotoLibrary;
        picker.delegate = [ImagePickerHelper sharedHelper];
        picker.allowsEditing = YES;
        [presenter presentViewController:picker animated:YES completion:nil];
    });
}

- (void)imagePickerController:(UIImagePickerController *)picker
    didFinishPickingMediaWithInfo:(NSDictionary<UIImagePickerControllerInfoKey, id> *)info {
    [picker dismissViewControllerAnimated:YES completion:nil];

    UIImage *selectedImage = info[UIImagePickerControllerEditedImage];
    if (!selectedImage) {
        selectedImage = info[UIImagePickerControllerOriginalImage];
    }

    NSString *dataUrl = DataUrlFromImage(selectedImage);
    NativeImagePickerBridge_notifyImageSelected(dataUrl ? dataUrl.UTF8String : "");
}

- (void)imagePickerControllerDidCancel:(UIImagePickerController *)picker {
    [picker dismissViewControllerAnimated:YES completion:nil];
    NativeImagePickerBridge_notifyImageSelected("");
}

@end
