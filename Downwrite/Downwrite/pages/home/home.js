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

        ready: function (element, options) {
            this._fragmentNode = element;

            this._fileListNode = this._fragmentNode.querySelector('#filelist');
            this._fileListNode.querySelector('li.new a').addEventListener('click', this._onFileListNewClicked.bind(this));

            this._appBar = element.querySelector('#appbar').winControl;
            if (window.intellisense) this._appBar = new WinJS.UI.AppBar();

            this._editingContentNode = element.querySelector('textarea');
            this._previewContentNode = element.querySelector('#preview-content');
            this._previewPaneNode = element.querySelector('#preview-pane');

            this._editingContentNode.addEventListener('keyup', this._onEditingContentKeyup.bind(this));
            this._editingContentNode.addEventListener('click', this._onEditingContentClick.bind(this));
            this._previewPaneNode.addEventListener('click', this._onPreviewPaneClick.bind(this));

            this.prepareAppBar();
            this.showFile(Downwrite.createFile());

            this._editingContentNode.value = '';

            this.togglePreview(false);
            WinJS.Promise.timeout(0).then(function () { this._editingContentNode.blur() }.bind(this));

            Downwrite.MainPage = this;
        },

        prepareAppBar: function () {
            this._appBar.sticky = true;
            this._appBar.getCommandById('cmdPreview').addEventListener('click', this._onCommandPreview.bind(this));
            this._appBar.getCommandById('cmdNew').addEventListener('click', this._onCommandNew.bind(this));
            this._appBar.getCommandById('cmdOpen').addEventListener('click', this._onCommandOpen.bind(this));
            this._appBar.getCommandById('cmdSave').addEventListener('click', this._onCommandSave.bind(this));
            this._appBar.getCommandById('cmdSaveAs').addEventListener('click', this._onCommandSaveAs.bind(this));
            this._appBar.onbeforeshow = function () {
                // update Edge UI filelist
                this.updateFileList();

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
            if (isVisible == undefined) isVisible = !this._isPreviewVisible;

            this._isPreviewVisible = isVisible;
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

        updateFileList: function () {
            // clear
            Array.prototype.forEach.call(this._fileListNode.querySelectorAll('li:not(.new)'), function (e) {
                this._fileListNode.removeChild(e);
            }.bind(this));

            Downwrite.OpenedFiles.forEach(function (downwriteFile) {
                // TODO: テンプレートに出す
                var liNode = document.createElement('li');
                liNode._downwriteFile = downwriteFile;

                var aNode = document.createElement('a');
                aNode.textContent = downwriteFile.name;
                aNode.classList.add('file-name');
                aNode.addEventListener('click', function (e) {
                    e.preventDefault();
                    this.showFile(downwriteFile);
                    WinJS.Utilities.query('li:not(.new)', this._fileListNode).removeClass('selected');
                    liNode.classList.add('selected');
                }.bind(this));
                var aNodeClose = document.createElement('a');
                aNodeClose.textContent = '\uE0C7';
                aNodeClose.classList.add('file-close-button');
                aNodeClose.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (downwriteFile.isUnsaved) {
                    } else {
                        Downwrite.closeFile(downwriteFile);
                        if (Downwrite.OpenedFiles.length != 0) {
                            if (this._currentFile == downwriteFile) {
                                this.showFile(Downwrite.OpenedFiles[0]);
                            }
                        } else {
                            this.showFile(Downwrite.createFile());
                        }

                        liNode.classList.remove('selected');
                        liNode.classList.add('deleting');
                        var deleteFromList = WinJS.UI.Animation.createDeleteFromListAnimation(liNode, this._fileListNode.querySelectorAll('li:not(.deleting)'));
                        liNode.style.opacity = '0';
                        liNode.style.position = 'fixed';
                        deleteFromList.execute().then(function () {
                            this._fileListNode.removeChild(liNode);
                            WinJS.Utilities.query('li:not(.new)', this._fileListNode).forEach(function (element) {
                                if (element._downwriteFile == this._currentFile) {
                                    element.classList.add('selected');
                                } else {
                                    element.classList.remove('selected');
                                }
                            }.bind(this));
                        }.bind(this));
                        //this.updateFileList();
                    }
                }.bind(this));
                liNode.appendChild(aNode);
                liNode.appendChild(document.createTextNode(' '));
                liNode.appendChild(aNodeClose);

                if (this._currentFile == downwriteFile) {
                    liNode.classList.add('selected');
                }

                this._fileListNode.insertAdjacentElement('afterBegin', liNode);
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
            this._currentFile = file;
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
        _onCommandNew: function (args) {
            this.showFile(Downwrite.createFile());
            this.updateFileList();
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
            this.updateFileList();
        },

        _onPreviewPaneClick: function (e) {
            this._appBar.hide();
        },

        _onEditingContentClick: function (e) {
            this._appBar.hide();
        },
        _onEditingContentKeyup: function (e) {
                if (e.keyCode == 90 && e.ctrlKey) {
                // Ctrl+Z: Undo
                e.preventDefault();
                e.stopPropagation();
                this.undo();
            } else if (e.keyCode == 83 && e.ctrlKey) {
                // Ctrl+S: Save
                e.preventDefault();
                e.stopPropagation();
                this.save();
            } else if (e.keyCode == 79 && e.ctrlKey) {
                // Ctrl+O: Open
                e.preventDefault();
                e.stopPropagation();
                this.open();
            } else {
                // update content & store to undo buffer
                this._currentFile.content = this._editingContentNode.value;

                // update status
                this.queueUpdate();
            }
        }
    });
})();
