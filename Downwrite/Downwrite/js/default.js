// For an introduction to the Navigation template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkId=232506
(function () {
    "use strict";

    WinJS.Binding.optimizeBindingReferences = true;

    var app = WinJS.Application;
    var activation = Windows.ApplicationModel.Activation;
    var nav = WinJS.Navigation;

    app.addEventListener("activated", function (args) {
        if (args.detail.kind === activation.ActivationKind.launch) {
            if (app.sessionState.history) {
                nav.history = app.sessionState.history;
            }
            args.setPromise(WinJS.UI.processAll().then(function () {
                if (nav.location) {
                    nav.history.current.initialPlaceholder = true;
                    return nav.navigate(nav.location, nav.state);
                } else {
                    return nav.navigate(Application.navigator.home);
                }
            }).then(function () {
                // Restore state after the pages are ready.
                if (args.detail.previousExecutionState === activation.ApplicationExecutionState.terminated) {
                    // Restore application state here.
                    app.sessionState.openedFiles.forEach(function (fileInfo) {
                        if (fileInfo.mruListToken) {
                            // open from MRU
                            Windows.Storage.AccessCache.StorageApplicationPermissions.mostRecentlyUsedList.getFileAsync(fileInfo.mruListToken).then(function (file) {
                                Downwrite.MainPage.openFile(file).then(function (downwriteFile) {
                                    if (fileInfo.isUnsaved) {
                                        downwriteFile.content = fileInfo.content;
                                        downwriteFile.lastChangedAt = fileInfo.lastChangedAt;
                                    }
                                });
                            });
                        } else {
                            // create
                            var downwriteFile = Downwrite.createFile();
                            downwriteFile._temporaryName = fileInfo.name;
                            downwriteFile.content        = fileInfo.content || '';
                            downwriteFile.lastChangedAt  = fileInfo.lastChangedAt;
                            downwriteFile.notify('name', downwriteFile.name); // for changing '_temporaryName' property
                        }
                    });
                    Downwrite.File._seqNum = app.sessionState.openedFilesSequenceNumber;
                }
            }));


        } else if (args.detail.kind === activation.ActivationKind.file) {
            // Launch with a file from Explorer or external program.
            var nextPromise;
            if (!Downwrite.MainPage) {
                nextPromise = WinJS.UI.processAll().then(function () {
                    if (nav.location) {
                        nav.history.current.initialPlaceholder = true;
                        return nav.navigate(nav.location, nav.state);
                    } else {
                        return nav.navigate(Application.navigator.home);
                    }
                });
            } else {
                nextPromise = WinJS.Promise.wrap();
            }

            nextPromise.then(function () {
                args.detail.files.forEach(function (file) {
                    Downwrite.MainPage.openFile(file);
                });
            });

            args.setPromise(nextPromise);
        }
    });

    app.oncheckpoint = function (args) {
        // TODO: This application is about to be suspended. Save any state
        // that needs to persist across suspensions here. If you need to 
        // complete an asynchronous operation before your application is 
        // suspended, call args.setPromise().
        app.sessionState.history = nav.history;

        app.sessionState.openedFilesSequenceNumber = Downwrite.File._seqNum;
        app.sessionState.openedFiles = Downwrite.OpenedFiles.map(function (downwriteFile) {
            /// <param name="downwriteFile" type="Downwrite.File" />
            var mruListToken;
            if (downwriteFile.file) {
                mruListToken = Windows.Storage.AccessCache.StorageApplicationPermissions.mostRecentlyUsedList.add(downwriteFile.file);
            }
            return {
                name         : downwriteFile.name,
                mruListToken : mruListToken,
                isUnsaved    : downwriteFile.isUnsaved,
                content      : (downwriteFile.isUnsaved ? downwriteFile.content : null),
                lastChangedAt: downwriteFile.lastChangedAt
            };
        });
    };

    app.onsettings = function (e) {
        e.detail.applicationcommands = {
            "Setting": { title: "Setting", href: "/pages/flyoutSetting/flyoutSetting.html" },
            "Help": { title: "Markdown Syntax", href: "/pages/flyoutHelp/flyoutHelp.html" },
        };
        WinJS.UI.SettingsFlyout.populateSettings(e);
    }

    app.start();
})();
