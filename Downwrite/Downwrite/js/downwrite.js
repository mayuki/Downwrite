(function () {
    "use strict";

    var Downwrite_File = WinJS.Class.define(function (file, content) {
        /// <summary></summary>
        this._initObservable();
        this._content = content || '';
        this._histories = [];
        this._temporaryName = "Untitled " + Downwrite.File._seqNum++;

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
                    this._histories.push({
                        content: this.content,
                        lastChangedAt: this.lastChangedAt
                    });
                    if (this._histories.length > 10) this._histories.shift(); // TODO: history size

                    this._content = value;
                    this.updateCounts();
                }
            }
        },
        
        name: {
            get: function () { return this.file ? this.file.name : this._temporaryName; }
        },

        isNew: {
            get: function () { return !this.file; }
        },
        isUnsaved: {
            get: function () {
                return (this.originalContent != this._content);
            }
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

        loadTempoarySavedContent: function () {
            /// <summary></summary>

        },

        save: function () {
            /// <summary></summary>

            // Convert CR+LF
            var content = this.content;
            if (this.lineMode == Downwrite.File.LineMode.CrLf) {
                content = content.replace(/\r?\n/g, "\r\n");
            }

            return Windows.Storage.FileIO.writeTextAsync(this.file, content)
                                         .then(function () { this.originalContent = this.content; return WinJS.Promise.wrap(); }.bind(this)); // update original
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
        WinJS.Binding.expandProperties({ isSelected: false, lineCount: 0, wordsCount: 0, charsCount: 0 })
    );


    WinJS.Namespace.define("Downwrite", {
        File: Downwrite_File,
        OpenedFiles: [],

        closeFile: function (targetFile) {
            Downwrite.OpenedFiles = Downwrite.OpenedFiles.filter(function (file) { return file != targetFile; });
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

})();