package com.mysteamlab.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

// AI Vision (gesture/object/face recognition) reads the camera through the
// browser's own getUserMedia() inside the WebView, not a native Capacitor
// plugin — so it needs two things neither Capacitor nor the manifest alone
// provide: the Android runtime permission prompt (requested below), and an
// explicit grant from the WebView's own WebChromeClient before it will hand
// camera/mic frames to the page at all.
public class MainActivity extends BridgeActivity {
    private static final int CAMERA_MIC_PERMISSION_REQUEST = 4201;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestCameraAndMicPermissions();

        getBridge().getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });
    }

    private void requestCameraAndMicPermissions() {
        String[] permissions = {
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        };

        boolean allGranted = true;
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (!allGranted) {
            ActivityCompat.requestPermissions(this, permissions, CAMERA_MIC_PERMISSION_REQUEST);
        }
    }
}
