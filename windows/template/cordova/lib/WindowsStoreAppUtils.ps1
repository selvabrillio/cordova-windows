<#
       Licensed to the Apache Software Foundation (ASF) under one
       or more contributor license agreements.  See the NOTICE file
       distributed with this work for additional information
       regarding copyright ownership.  The ASF licenses this file
       to you under the Apache License, Version 2.0 (the
       "License"); you may not use this file except in compliance
       with the License.  You may obtain a copy of the License at

         http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing,
       software distributed under the License is distributed on an
       "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
       KIND, either express or implied.  See the License for the
       specific language governing permissions and limitations
       under the License.
#>
$code = @"
using System;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
namespace StoreAppRunner 
{
    public enum ActivateOptions
    {
        None = 0,
        DesignMode = 0x1,
        NoErrorUI = 0x2,
        NoSplashScreen = 0x4
    }

    [ComImport]
    [Guid("2e941141-7f97-4756-ba1d-9decde894a3d")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IApplicationActivationManager
    {
        IntPtr ActivateApplication([In] String appUserModelId, [In] String arguments, [In] ActivateOptions options, [Out] out UInt32 processId);
        IntPtr ActivateForFile([In] String appUserModelId, [In] IntPtr itemArray, [In] String verb, [Out] out UInt32 processId);
        IntPtr ActivateForProtocol([In] String appUserModelId, [In] IntPtr itemArray, [Out] out UInt32 processId);
    }
    [ComImport]
    [Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
    public class ApplicationActivationManager : IApplicationActivationManager
    {
        [MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
        public extern IntPtr ActivateApplication([In] String appUserModelId, [In] String arguments, [In] ActivateOptions options, [Out] out UInt32 processId);
        [MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
        public extern IntPtr ActivateForFile([In] String appUserModelId, [In] IntPtr itemArray, [In] String verb, [Out] out UInt32 processId);
        [MethodImpl(MethodImplOptions.InternalCall, MethodCodeType = MethodCodeType.Runtime)]
        public extern IntPtr ActivateForProtocol([In] String appUserModelId, [In] IntPtr itemArray, [Out] out UInt32 processId);
    }

    [ComImport, Guid("B1AEC16F-2383-4852-B0E9-8F0B1DC66B4D")]
    public class PackageDebugSettings
    {
    }
    public enum PACKAGE_EXECUTION_STATE
    {
        PES_UNKNOWN,
        PES_RUNNING,
        PES_SUSPENDING,
        PES_SUSPENDED,
        PES_TERMINATED
    }
    [ComImport, Guid("F27C3930-8029-4AD1-94E3-3DBA417810C1"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IPackageDebugSettings
    {
        int EnableDebugging([MarshalAs(UnmanagedType.LPWStr)] string packageFullName, [MarshalAs(UnmanagedType.LPWStr)] string debuggerCommandLine, IntPtr environment);
        int DisableDebugging([MarshalAs(UnmanagedType.LPWStr)] string packageFullName);
        int Suspend([MarshalAs(UnmanagedType.LPWStr)] string packageFullName);
        int Resume([MarshalAs(UnmanagedType.LPWStr)] string packageFullName);
        int TerminateAllProcesses([MarshalAs(UnmanagedType.LPWStr)] string packageFullName);
        int SetTargetSessionId(int sessionId);
        int EnumerageBackgroundTasks([MarshalAs(UnmanagedType.LPWStr)] string packageFullName,
                                                      out uint taskCount, out int intPtr, [Out] string[] array);
        int ActivateBackgroundTask(IntPtr something);
        int StartServicing([MarshalAs(UnmanagedType.LPWStr)] string packageFullName);
        int StopServicing([MarshalAs(UnmanagedType.LPWStr)] string packageFullName);
        int StartSessionRedirection([MarshalAs(UnmanagedType.LPWStr)] string packageFullName, uint sessionId);
        int StopSessionRedirection([MarshalAs(UnmanagedType.LPWStr)] string packageFullName);
        int GetPackageExecutionState([MarshalAs(UnmanagedType.LPWStr)] string packageFullName,
                                            out PACKAGE_EXECUTION_STATE packageExecutionState);
        int RegisterForPackageStateChanges([MarshalAs(UnmanagedType.LPWStr)] string packageFullName,
                               IntPtr pPackageExecutionStateChangeNotification, out uint pdwCookie);
        int UnregisterForPackageStateChanges(uint dwCookie);
    }

    public class ApplicationActivator
    {
        [DllImport("Ole32.dll")]
        private static extern int CoAllowSetForegroundWindow(IntPtr pUnk, IntPtr lpvReserved);

        public static int Activate(String appUserModelId, String packageFullName)
        {
            uint PID = 0;
            //// Create ApplicationActivationManager instance and get its' handle
            var runner = new ApplicationActivationManager();
            //// Without this call, the app will be launched but will not be brought to the foreground.
            CoAllowSetForegroundWindow(Marshal.GetIUnknownForObject(runner), (IntPtr)null);
            // Set debug mode for App and activate installed application
            var debugSettings = (IPackageDebugSettings)(new PackageDebugSettings());
            debugSettings.EnableDebugging(packageFullName, null, (IntPtr)null);
            runner.ActivateApplication(appUserModelId, null, ActivateOptions.None, out PID);
            try
            {
                PACKAGE_EXECUTION_STATE appState;
                if (debugSettings.GetPackageExecutionState(packageFullName, out appState) == 0 &&
                    (appState == PACKAGE_EXECUTION_STATE.PES_SUSPENDED ||
                     appState == PACKAGE_EXECUTION_STATE.PES_SUSPENDING))
                {
                    debugSettings.Resume(packageFullName);
                }
            }
            catch
            {
                Console.WriteLine("[WARN] Can't get/set application's execution state!");
            }
            //// return PID of running app or 0, if app isn't started
            return (int) PID;
        }
    }
}
"@

function Uninstall-App {
    param(
        [Parameter(Mandatory=$true, Position=0, ValueFromPipelineByPropertyName=$true)]
        [string] $ID <# package.appxmanifest//Identity@name #>
    )

    $package = Get-AppxPackage $ID

    if($package) {
        Remove-AppxPackage $package.PackageFullName
    }
}

#
# Checks whether the machine is missing a valid developer license.
#
function CheckIfNeedDeveloperLicense
{
    $Result = $true
    try
    {
        $Result = (Get-WindowsDeveloperLicense | Where-Object { $_.IsValid }).Count -eq 0
    }
    catch {}

    return $Result
}

#
# Checks whether the package certificate must be installed on the machine.
#
function CheckIfNeedInstallCertificate
{
    param(
        [Parameter(Mandatory=$true, Position=0, ValueFromPipelineByPropertyName=$true)]
        [string] $ScriptDir <# Full path to the dir where Add-AppDevPackage.ps1 is stored #>
    )

    $PackagePath = Get-ChildItem (Join-Path $ScriptDir "*.appx") | Where-Object { $_.Mode -NotMatch "d" }
    $BundlePath = Get-ChildItem (Join-Path $ScriptDir "*.appxbundle") | Where-Object { $_.Mode -NotMatch "d" }
    # There must be exactly 1 package/bundle
    if (($PackagePath.Count + $BundlePath.Count) -lt 1)
    {
        Throw "The app package has not been found at dir $ScriptDir"
    }
    if (($PackagePath.Count + $BundlePath.Count) -gt 1)
    {
        Throw "To many app packages have been found at dir $ScriptDir"
    }

    if ($PackagePath.Count -ne 1) # there is *.appxbundle
    {
        $PackagePath = $BundlePath
    }

    $PackageSignature = (Get-AuthenticodeSignature $PackagePath)
    $Valid = ($PackageSignature -and $PackageSignature.Status -eq "Valid")
    return (-not $Valid)
}

function Install-App {
    param(
        [Parameter(Mandatory=$true, Position=0, ValueFromPipelineByPropertyName=$true)]
        [string] $Path <# Full path to Add-AppDevPackage.ps1 #>
    )
    if ((CheckIfNeedDeveloperLicense) -or (CheckIfNeedInstallCertificate (Join-Path $Path "..")))
    {
        # we can't run the script with -force param if license/certificate installation step is required
        Invoke-Expression ("& `"$Path`"")
    }
    else
    {
        Invoke-Expression ("& `"$Path`" -force")
    }
}

function Start-Locally {
    param(
        [Parameter(Mandatory=$true, Position=0, ValueFromPipelineByPropertyName=$true)]
        [string] $ID <# package.appxmanifest//Identity@name #>
    )

    $package = Get-AppxPackage $ID
    $manifest = Get-appxpackagemanifest $package
    $applicationUserModelId = $package.PackageFamilyName + "!" + $manifest.package.applications.application.id
    $packageFullName = $package.PackageFullName

    add-type -TypeDefinition $code
    Write-Host "ActivateApplication: " $applicationUserModelId "PID: " $([StoreAppRunner.ApplicationActivator]::Activate($applicationUserModelId, $packageFullName))
}