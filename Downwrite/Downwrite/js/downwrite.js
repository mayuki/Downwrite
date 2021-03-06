﻿(function () {
    "use strict";

    var Downwrite_File = WinJS.Class.define(function (file, content) {
        /// <summary></summary>
        this._initObservable();
        this._content = content || '';
        this._histories = [];
        this._temporaryName = "Untitled " + Downwrite.File._seqNum++;
        this._isUnsaved = false;

        // line mode
        this.lineMode = this._content.match(/\r\n/) ? Downwrite.File.LineMode.CrLf
                                                    : Downwrite.File.LineMode.Lf;
        if (this.lineMode == Downwrite.File.LineMode.CrLf) {
            // normalize (CR+LF -> LF)
            this._content = this._content.replace(/\r?\n/g, "\n");
        }

        this.isSelected = false;
        this.file = null || file;
        this.lineCount = 0;
        this.wordsCount = 0;
        this.charsCount = 0;
        this.lastChangedAt = new Date();
        this.originalContent = this._content;

        this.bind('file', function () {
            this.notify('name', this.name);
        }.bind(this));

        var updateIsUnsaved = function () {
            var prevValue = this._isUnsaved;
            this._isUnsaved = (this.originalContent != this._content);

            if (this._isUnsaved != prevValue) {
                this.notify('isUnsaved', this._isUnsaved, prevValue);
            }
        }.bind(this);

        this.bind('content', updateIsUnsaved);
        this.bind('originalContent', updateIsUnsaved);

        this.updateCounts();
    }, {
        updateCounts: function () {
            /// <summary></summary>
            this.lineCount = (this.content.match(/\n/g) || []).length + 1;
            this.wordsCount = (this.content.match(/\b/g) || []).length / 2;
            this.charsCount = (this.content.match(/[^\s]/g) || []).length;
        },

        content: {
            get: function () {
                return this._content;
            },
            set: function (value) {
                if (this._content != value) {
                    var prevValue = this.content;
                    this._histories.push({
                        content: this.content,
                        lastChangedAt: this.lastChangedAt
                    });
                    if (this._histories.length > 10) this._histories.shift(); // TODO: history size

                    this._content = value;
                    this.updateCounts();

                    this.notify('content', value, prevValue);
                }
            }
        },

        file: {
            get: function () { return this._file; },
            set: function (value) { var orig = this._file; this._file = value; this.notify('file', value, orig); }
        },
        
        name: {
            get: function () { return this.file ? this.file.name : this._temporaryName; }
        },

        isNew: {
            get: function () { return !this.file; }
        },

        isUnsaved: {
            get: function () { return this._isUnsaved; }
        },

        historyCount: {
            get: function () {
                return this._histories.length;
            }
        },

        undo: function () {
            /// <summary></summary>
            var history = this._histories.pop();
            if (!history) return false;

            this._content = history.content; // prevent storing a text to undo buffer
            this.lastChangedAt = history.lastChangedAt;
            this.updateCounts();

            return true;
        },

        save: function () {
            /// <summary></summary>

            // Convert CR+LF
            var content = this.content;
            if (this.lineMode == Downwrite.File.LineMode.CrLf) {
                content = content.replace(/\r?\n/g, "\r\n");
            }

            return Windows.Storage.FileIO.writeTextAsync(this.file, content)
                                         .then(function () {
                                             this.originalContent = this.content;
                                             return WinJS.Promise.timeout(0);
                                         }.bind(this)); // update original
        },
        
        saveAs: function (file) {
            /// <summary></summary>
            this.file = file;
            return this.save();
        },

        load: function () {
            /// <summary></summary>
            return Windows.Storage.FileIO.readTextAsync(this.file).then(function (fileContent) {
                this.isDirty = false;
                this.originalText = fileContent;
                this.content = fileContent;
                this.lastChangedAt = new Date();

                this.updateCounts();
            }.bind(this));
        },

        toHTML: function () {
            /// <summary></summary>
            return markdown.toHTML(this.content);
        }
    }, {
        // static members
        _seqNum: 1,

        loadFromFile: function (file) {
            /// <summary></summary>
            return Windows.Storage.FileIO.readTextAsync(file).then(function (fileContent) {
                return WinJS.Promise.wrap(new Downwrite.File(file, fileContent));
            });
        },
        LineMode: {
            'CrLf': 0,
            'Lf': 1
        }
    });
    WinJS.Class.mix(Downwrite_File,
        WinJS.Binding.mixin,
        WinJS.Binding.expandProperties({ isSelected: false, lineCount: 0, wordsCount: 0, charsCount: 0, originalContent: '' })
    );


    var Downwrite_Setting = WinJS.Class.define(function () {
        this._initObservable();

        // default values
        this.isPreviewVisible = true;
        this.fontSize = 20;

        // set bind
        ['isPreviewVisible', 'fontSize'].forEach(function (propName) {
            this._loadPropertyFromAppData(propName);
            this._setSaveActionForProperty(propName);
        }.bind(this));
    }, {
        // instance members
        /// <field name="isPreviewVisible" type="Boolean"></field>
        isPreviewVisible: true,

        /// <field name="fontSize" type="Number"></field>
        fontSize: 20,

        // private instance members
        _loadPropertyFromAppData: function (propName, defaultValue) {
            var appData = Windows.Storage.ApplicationData.current;
            defaultValue = (defaultValue || this[propName]);
            var value = JSON.parse(appData.localSettings.values[propName] || 'null');
            this[propName] = (value != null ? value : defaultValue);
        },
        _setSaveActionForProperty: function (propName) {
            this.bind(propName, function () {
                var appData = Windows.Storage.ApplicationData.current;
                appData.localSettings.values[propName] = JSON.stringify(this[propName]);
                appData.signalDataChanged();
            }.bind(this));
        }
    }, {
        /// <field name="current" type="Downwrite.Setting" />
        current: null
    });
    WinJS.Class.mix(Downwrite_Setting,
        WinJS.Binding.mixin,
        WinJS.Binding.expandProperties({ isPreviewVisible: true, fontSize: 0 })
    );

    WinJS.Namespace.define("Downwrite", {
        MainPage: null,

        Setting: Downwrite_Setting,

        File: Downwrite_File,
        OpenedFiles: new WinJS.Binding.List([]),

        closeFile: function (targetFile) {
            var index = Downwrite.OpenedFiles.indexOf(targetFile);
            if (index > -1) {
                Downwrite.OpenedFiles.splice(index, 1);
            }
        },
        openFile: function (file) {
            // TODO: 多重オープン
            return Downwrite.File.loadFromFile(file).then(function (downwriteFile) {
                Downwrite.OpenedFiles.push(downwriteFile);
                return WinJS.Promise.wrap(downwriteFile);
            }.bind(this));
        },
        createFile: function () {
            var file = new Downwrite.File();
            Downwrite.OpenedFiles.push(file);
            return file;
        }
    });

    Downwrite.Setting.current = new Downwrite.Setting();
})();