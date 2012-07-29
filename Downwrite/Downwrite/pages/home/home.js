(function () {
    "use strict";

    WinJS.UI.Pages.define("/pages/home/home.html", {
        /// <field name="_fragmentNode" type="HTMLElement" />
        _fragmentNode: null,
        /// <field name="_updateQueue" type="WinJS.Promise" />
        _updateQueue: WinJS.Promise.wrap(),
        /// <field name="_statusBarCountUpdateAnimating" type="WinJS.Promise" />
        _statusBarCountUpdateAnimating: WinJS.Promise.wrap(),
        /// <field name="_editingContentNode" type="HTMLTextareaElement" />
        _editingContentNode: null,
        /// <field name="_previewContentNode" type="HTMLDivElement" />
        _previewContentNode: null,
        /// <field name="_fileListNode" type="HTMLDivElement" />
        _fileListNode: null,
        /// <field name="_appBar" type="WinJS.UI.AppBar" />
        _appBar: null,
        /// <field name="_currentFile" type="Downwrite.File" />
        _currentFile: null,
        /// <field name="_isPreviewVisible" type="Boolean" />
        _isPreviewVisible: false,
        /// <field name="_fileListItemTemplate" type="WinJS.Binding.Template" />
        _fileListItemTemplate: false,

        ready: function (element, options) {
            this.initializeComponents(element);

            this.prepareAppBar();
            this.togglePreview(Downwrite.Setting.current.isPreviewVisible);
            this.setSharingContract();

            // events
            window.addEventListener('resize', this._onResized.bind(this));
            window.addEventListener('scroll', this._onScrolled.bind(this));

            // ready!
            Downwrite.MainPage = this;
            this.showFile(Downwrite.createFile());
        },

        unload: function () {
            window.removeEventListener('resize', this._onResized.bind(this));
            window.removeEventListener('scroll', this._onScrolled.bind(this));

            this.unsetSharingContract();
        },

        // -- methods

        initializeComponents: function (element) {
            this._fragmentNode = element;

            // filelist
            this._fileListNode = this._fragmentNode.querySelector('#filelist');
            this._fileListNode.querySelector('.filelist-item-new a').addEventListener('click', this._onFileListNewClicked.bind(this));

            // filelist template
            this._fileListItemTemplate = element.querySelector('#template-filelist-item').winControl;
            if (window.intellisense) this._fileListItemTemplate = new WinJS.Binding.Template();

            // appbar
            this._appBar = element.querySelector('#appbar').winControl;
            if (window.intellisense) this._appBar = new WinJS.UI.AppBar();

            // editingcontent/previewcontent/previewpane
            this._editingContentNode = element.querySelector('textarea');
            this._previewContentNode = element.querySelector('#preview-content');
            this._previewPaneNode = element.querySelector('#preview-pane');
            this._editingContentNode.addEventListener('input', this._onEditingContentInput.bind(this));
            this._editingContentNode.addEventListener('keyup', this._onEditingContentKeyup.bind(this));
            this._editingContentNode.addEventListener('click', this._onEditingContentClick.bind(this));
            this._previewPaneNode.addEventListener('click', this._onPreviewPaneClick.bind(this));
            this._editingContentNode.value = ''; // WORKAROUND: (Win8RP)なぜかplaceholderの値が入ってしまうので消す…。

            // databind
            Downwrite.OpenedFiles.addEventListener('iteminserted', this._onItemInserted.bind(this));
            Downwrite.OpenedFiles.addEventListener('itemremoved', this._onItemRemoved.bind(this));

            Downwrite.Setting.current.bind('fontSize', this._onFontSizeChanged.bind(this));
        },

        setSharingContract: function () {
            var dataTransferManager = Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView();
            dataTransferManager.addEventListener("datarequested", this._onDataRequested.bind(this));
        },
        unsetSharingContract: function () {
            var dataTransferManager = Windows.ApplicationModel.DataTransfer.DataTransferManager.getForCurrentView();
            dataTransferManager.removeEventListener("datarequested", this._onDataRequested.bind(this));
        },

        prepareAppBar: function () {
            this._appBar.sticky = true;
            this._appBar.getCommandById('cmdPreview').addEventListener('click', this._onCommandPreview.bind(this));
            this._appBar.getCommandById('cmdNew').addEventListener('click', this._onCommandNew.bind(this));
            this._appBar.getCommandById('cmdOpen').addEventListener('click', this._onCommandOpen.bind(this));
            this._appBar.getCommandById('cmdSave').addEventListener('click', this._onCommandSave.bind(this));
            this._appBar.getCommandById('cmdSaveAs').addEventListener('click', this._onCommandSaveAs.bind(this));
            this._appBar.getCommandById('cmdUndo').addEventListener('click', this._onCommandUndo.bind(this));
            this._appBar.onbeforeshow = function () {
                this._fileListNode.style.display = 'block';
                WinJS.UI.Animation.showEdgeUI(this._fileListNode);
            }.bind(this);
            this._appBar.onbeforehide = function () {
                WinJS.UI.Animation.hideEdgeUI(this._fileListNode).then(function () {
                    this._fileListNode.style.display = 'none';
                }.bind(this));
            }.bind(this);
        },


        togglePreview: function (isVisible) {
            if (isVisible == undefined) {
                isVisible = !this._isPreviewVisible;
            }

            this._isPreviewVisible = isVisible;
            Downwrite.Setting.current.isPreviewVisible = this._isPreviewVisible;

            this._appBar.getCommandById('cmdPreview').selected = isVisible;

            var editPane = this._fragmentNode.querySelector('#edit-pane');
            var previewPane = this._fragmentNode.querySelector('#preview-pane');
            if (isVisible) {
                editPane.classList.add('preview-visible');
                previewPane.style.display = 'block';
                WinJS.UI.Animation.showPanel(previewPane);
            } else {
                WinJS.UI.Animation.hidePanel(previewPane, [{ top: "0px", left: WinJS.Utilities.getContentWidth(previewPane)+'px', rtlflip: true }]).then(function () {
                    editPane.classList.remove('preview-visible');
                    previewPane.style.display = 'none';
                });
            }
        },

        queueUpdate: function () {
            this._updateQueue.cancel();

            this._updateQueue = WinJS.Promise.timeout(250).then(function () {
                this.updatePreview();
                this.updateStatusBar();
            }.bind(this));
        },

        updateStatusBar: function () {
            // Filename
            var fileAreaNode = this._fragmentNode.querySelector('#statusbar .file');
            fileAreaNode.textContent = this._currentFile.name;

            // Dirty Flag
            if (this._currentFile.isUnsaved != this._prevIsUnsaved) {
                var isChangedMarkAreaNode = this._fragmentNode.querySelector('#statusbar .is-changed');
                var affectedAreaNodes = this._fragmentNode.querySelectorAll('#statusbar li:not(.is-changed)');
                if (this._currentFile.isUnsaved) {
                    var expandAnim = WinJS.UI.Animation.createExpandAnimation(isChangedMarkAreaNode, affectedAreaNodes);
                    isChangedMarkAreaNode.style.display = 'block';
                    expandAnim.execute();
                } else {
                    var collapseAnim = WinJS.UI.Animation.createCollapseAnimation(isChangedMarkAreaNode, affectedAreaNodes);
                    isChangedMarkAreaNode.style.display = 'none';
                    collapseAnim.execute();
                }
            }

            // Line Count etc...
            var lineCountNode = this._fragmentNode.querySelector('#line-count');
            var wordsCountNode = this._fragmentNode.querySelector('#words-count');
            var charsCountNode = this._fragmentNode.querySelector('#chars-count');

            lineCountNode.textContent  = this._currentFile.lineCount;
            wordsCountNode.textContent = this._currentFile.wordsCount;
            charsCountNode.textContent = this._currentFile.charsCount;

            var targetElements = [];
            if (this._prevLineCount != lineCountNode.textContent) targetElements.push(lineCountNode);
            if (this._prevWordsCount != wordsCountNode.textContent) targetElements.push(wordsCountNode);
            if (this._prevCharsCount != charsCountNode.textContent) targetElements.push(charsCountNode);
            this._statusBarCountUpdateAnimating.cancel();
            this._statusBarCountUpdateAnimating = WinJS.UI.Animation.updateBadge(targetElements);

            // prev values
            this._prevIsUnsaved = this._currentFile.isUnsaved;
            this._prevLineCount = this._currentFile.lineCount;
            this._prevWordsCount = this._currentFile.wordsCount;
            this._prevCharsCount = this._currentFile.charsCount;
        },
        updatePreview: function () {
            this._previewContentNode.innerHTML = this._currentFile.toHTML();
        },

        showFile: function (file) {
            if (this._currentFile) {
                this._currentFile.isSelected = false;
            }

            this._currentFile = file;
            this._currentFile.isSelected = true;
            this._editingContentNode.value = file.content;
            this.updatePreview();
            this.updateStatusBar();
        },

        openFile: function (file) {
            if (this._currentFile.isNew && !this._currentFile.isUnsaved) {
                // unchanged & new file
                Downwrite.closeFile(this._currentFile);
            }

            return Downwrite.openFile(file).then(function (downwriteFile) {
                this.showFile(downwriteFile);

                return WinJS.Promise.wrap(downwriteFile);
            }.bind(this));
        },

        closeFile: function (downwriteFile) {
            var promise = WinJS.Promise.wrap();
            if (downwriteFile.isUnsaved) {
                var msgDialog = Windows.UI.Popups.MessageDialog("File '" + downwriteFile.name + "' was changed.", "Save Changes?");
                msgDialog.commands.append(new Windows.UI.Popups.UICommand("Save", null, "Save"));
                msgDialog.commands.append(new Windows.UI.Popups.UICommand("Discard Changes", null, "Close"));
                msgDialog.commands.append(new Windows.UI.Popups.UICommand("Cancel", null, "Cancel"));
                msgDialog.cancelCommandIndex = 2;

                // show dialog 
                promise = msgDialog.showAsync().then(function (result) {
                    switch (result.id) {
                        case 'Save':
                            return this.save();
                            break;
                        case 'Close':
                            return WinJS.Promise.wrap();
                            break;
                        default:
                            // Cancel
                            return WinJS.Promise.wrapError();
                            break;
                    }
                }.bind(this));
            }

            // close & open next file
            promise.then(function () {
                Downwrite.closeFile(downwriteFile);
                if (Downwrite.OpenedFiles.length != 0) {
                    if (this._currentFile == downwriteFile) {
                        this.showFile(Downwrite.OpenedFiles.getAt(0));
                    }
                } else {
                    this.showFile(Downwrite.createFile());
                }
            }.bind(this));
        },

        undo: function () {
            if (this._currentFile.undo()) {
                this._editingContentNode.value = this._currentFile.content;
                this.updatePreview();
                this.updateStatusBar();
            }
        },

        save: function () {
            if (this._currentFile.isNew) {
                return this.saveAs();
            }

            return this._currentFile.save().then(function () {
                this.updateStatusBar();
            }.bind(this));
        },

        saveAs: function () {
            var picker = new Windows.Storage.Pickers.FileSavePicker();
            picker.defaultFileExtension = ".md";
            picker.fileTypeChoices.insert("Text File", [".txt"]);
            picker.fileTypeChoices.insert("Markdown File", [".md"]);

            return picker.pickSaveFileAsync()
                            .then(function (file) {
                                if (file) {
                                    return this._currentFile.saveAs(file);
                                }
                            }.bind(this))
                            .then(function () {
                                this.updateStatusBar();
                            }.bind(this));
        },

        open: function () {
            var picker = new Windows.Storage.Pickers.FileOpenPicker();
            picker.fileTypeFilter.replaceAll([".txt", ".md", ".markdown"]);
            
            return picker.pickSingleFileAsync().then(function (file) {
                if (file) {
                    if (this._currentFile.isNew && !this._currentFile.isUnsaved) {
                        // unchanged & new file
                        Downwrite.closeFile(this._currentFile);
                    }

                    return Downwrite.openFile(file).then(function (downwriteFile) {
                        this.showFile(downwriteFile);
                    }.bind(this));
                }
            }.bind(this))
        },

        // -- events
        _scrolledAnimationPromise: WinJS.Promise.wrap(),
        _onScrolled: function () {
            this._scrolledAnimationPromise.cancel();

            this._scrolledAnimationPromise = WinJS.Promise.timeout(500).then(function () {
                var statusBar = this._fragmentNode.querySelector('#statusbar');
                var keyboardHeight = window.outerHeight - window.innerHeight;
                if (keyboardHeight > 0) {
                    statusBar.style.bottom = (keyboardHeight - window.pageYOffset) + 'px';
                } else {
                    statusBar.style.bottom = '0px';
                }
            }.bind(this));
        },
        _onResized: function() {
            var statusBar = this._fragmentNode.querySelector('#statusbar');
            var keyboardHeight = window.outerHeight - window.innerHeight;
            if (keyboardHeight > 0) {
                statusBar.style.bottom = (keyboardHeight - window.pageYOffset) + 'px';
            } else {
                statusBar.style.bottom = '0px';
            }
        },
        _onCommandUndo: function (args) {
            this.undo();
        },
        _onCommandNew: function (args) {
            this.showFile(Downwrite.createFile());
        },
        _onCommandOpen: function (args) {
            this.open().then(function () {
                this._appBar.hide();
            }.bind(this));
        },
        _onCommandSave: function (args) {
            this.save().then(function () {;
                this._appBar.hide();
            }.bind(this));
        },
        _onCommandSaveAs: function (args) {
            this.saveAs().then(function () { 
                this._appBar.hide();
            }.bind(this));
        },
        _onCommandPreview: function (args) {
            this.togglePreview();
        },

        _onFileListNewClicked: function (e) {
            this.showFile(Downwrite.createFile());
        },

        _onPreviewPaneClick: function (e) {
            this._appBar.hide();
        },

        _onEditingContentClick: function (e) {
            this._appBar.hide();
        },
        _onEditingContentInput: function (e) {
            // update content & store to undo buffer
            if (this._currentFile.content != this._editingContentNode.value) {
                this._currentFile.content = this._editingContentNode.value;

                // update status
                this.queueUpdate();
            }
        },
        _onEditingContentKeyup: function (e) {
            if (e.ctrlKey) {
                switch (e.key) {
                    case 'z':
                        // Ctrl+Z: Undo
                        this.undo();
                        break;
                    case 's':
                        // Ctrl+S: Save
                        this.save();
                        break;
                    case 'o':
                        // Ctrl+O: Open
                        this.open();
                        break;
                    case 'e':
                        // Ctrl+E: Preview
                        this.togglePreview();
                        break;
                    case 't':
                    case 'n':
                        // Ctrl+T/Ctrl+N: New
                        this.showFile(Downwrite.createFile());
                        break;
                    case 'w':
                        // Ctrl-W: Close
                        this.closeFile(this._currentFile);
                        break;
                    case 'Tab':
                        // Ctrl-Tab: Switch
                        if (Downwrite.OpenedFiles.length < 1) return;

                        var nextIndex = 0;
                        var index = Downwrite.OpenedFiles.indexOf(this._currentFile);
                        if (e.shiftKey) {
                            if (index == 0) {
                                nextIndex = Downwrite.OpenedFiles.length - 1;
                            } else {
                                nextIndex = index - 1;
                            }
                        } else {
                            if (index + 1 < Downwrite.OpenedFiles.length) {
                                nextIndex = index + 1;
                            }
                        }
                        this.showFile(Downwrite.OpenedFiles.getAt(nextIndex));
                        break;
                    default:
                        // cancel
                        return;
                }
                e.stopPropagation();
                e.preventDefault();
            }
        },

        _onItemInserted: function (args) {
            var downwriteFile = args.detail.value;
            this._fileListItemTemplate.render(downwriteFile).done(function (fileListItemNode) {
                fileListItemNode._downwriteFile = downwriteFile;

                fileListItemNode.querySelector('.filelist-item-name').addEventListener('click', function (e) {
                    e.preventDefault();
                    this.showFile(downwriteFile);
                }.bind(this));

                fileListItemNode.querySelector('.filelist-item-close').addEventListener('click', function (e) {
                    e.preventDefault();
                    this.closeFile(downwriteFile);
                }.bind(this));

                var addFromList = WinJS.UI.Animation.createAddToListAnimation(fileListItemNode, this._fileListNode.querySelectorAll('.win-template'));
                this._fileListNode.insertBefore(fileListItemNode, this._fileListNode.lastElementChild);
                addFromList.execute();

            }.bind(this));
        },

        _onItemRemoved: function (args) {
            var downwriteFile = args.detail.value;
            var templateItems = this._fileListNode.querySelectorAll('.win-template');
            for (var i = 0, n = templateItems.length; i < n; i++) {
                var templateItem = templateItems[i];
                if (templateItem._downwriteFile == downwriteFile) {
                    // remove animation
                    templateItem.classList.add('deleting');
                    var deleteFromList = WinJS.UI.Animation.createDeleteFromListAnimation(templateItem, this._fileListNode.querySelectorAll('.win-template:not(.deleting)'));
                    templateItem.style.opacity = '0';
                    templateItem.style.position = 'fixed';
                    deleteFromList.execute().then(function () {
                        // animation complete
                        this._fileListNode.removeChild(templateItem);
                    }.bind(this));

                    break;
                }
            }
        },

        _onDataRequested: function (e) {
            var request = e.request;
            var dataPackage = new Windows.ApplicationModel.DataTransfer.DataPackage();
            var htmlFormat = Windows.ApplicationModel.DataTransfer.HtmlFormatHelper.createHtmlFormat(this._currentFile.toHTML());

            if (htmlFormat != '') {
                dataPackage.setHtmlFormat(htmlFormat);
                dataPackage.properties.title = this._currentFile.name;

                request.data = dataPackage;
            }
        },

        _onFontSizeChanged: function (newValue, oldValue) {
            this._editingContentNode.style.fontSize = newValue + 'pt';

            // WORKAROUND: (RP) Force recalc line-height
            var origPaddingRight = this._editingContentNode.currentStyle.paddingRight;
            this._editingContentNode.style.paddingRight = (parseInt(origPaddingRight, 10) + 1) + 'px';
            WinJS.Promise.timeout(100)
                            .then(function () {
                                this._editingContentNode.style.paddingRight = '';
                            }.bind(this));
        }
    });
})();
