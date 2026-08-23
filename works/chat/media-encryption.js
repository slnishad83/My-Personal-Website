'use strict';

(function () {
  var MAX_FILE_SIZE = 100 * 1024 * 1024;

  var MIME_MAP = {
    'image/jpeg': 'image/jpeg',
    'image/jpg': 'image/jpeg',
    'image/png': 'image/png',
    'image/gif': 'image/gif',
    'image/webp': 'image/webp',
    'video/mp4': 'video/mp4',
    'video/webm': 'video/webm',
    'audio/mpeg': 'audio/mpeg',
    'audio/mp3': 'audio/mpeg',
    'audio/ogg': 'audio/ogg',
    'audio/wav': 'audio/wav',
    'audio/x-wav': 'audio/wav',
    'audio/aac': 'audio/aac',
    'audio/mp4': 'audio/mp4',
    'application/pdf': 'application/pdf',
    'application/msword': 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain': 'text/plain',
    'application/octet-stream': 'application/octet-stream'
  };

  var EXTENSION_MAP = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain'
  };

  var ENCRYPTABLE_PREFIXES = [
    'image/',
    'video/',
    'audio/',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats',
    'text/plain',
    'application/octet-stream'
  ];

  function _debug() {
    if (window.__DEBUG__) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[MediaEncryption]');
      console.log.apply(console, args);
    }
  }

  function _arrayBufferToBase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function _base64ToArrayBuffer(base64) {
    var binary = window.atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function _getFileType(file) {
    if (file.type && MIME_MAP[file.type]) {
      return file.type;
    }

    var name = file.name || '';
    var ext = name.split('.').pop().toLowerCase();
    if (EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext];
    }

    return 'application/octet-stream';
  }

  function _isEncryptableType(mimeType) {
    if (!mimeType) return false;
    for (var i = 0; i < ENCRYPTABLE_PREFIXES.length; i++) {
      if (mimeType.indexOf(ENCRYPTABLE_PREFIXES[i]) === 0) {
        return true;
      }
    }
    return false;
  }

  function _generateIv() {
    return crypto.getRandomValues(new Uint8Array(12));
  }

  async function _generateKey() {
    return crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async function _importKey(base64) {
    var raw = _base64ToArrayBuffer(base64);
    return crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  async function _exportKey(key) {
    var raw = await crypto.subtle.exportKey('raw', key);
    return _arrayBufferToBase64(raw);
  }

  async function encryptFile(fileBlob) {
    _debug('encryptFile called', fileBlob.size, fileBlob.type);

    var mimeType = fileBlob.type || 'application/octet-stream';

    if (fileBlob.size > MAX_FILE_SIZE) {
      _debug('File exceeds 100MB limit');
      throw new Error('File size exceeds the 100MB encryption limit');
    }

    if (!_isEncryptableType(mimeType)) {
      _debug('File type not encryptable:', mimeType);
      throw new Error('File type "' + mimeType + '" does not support encryption');
    }

    var iv = _generateIv();
    var key = await _generateKey();
    var keyBase64 = await _exportKey(key);
    var ivBase64 = _arrayBufferToBase64(iv);

    var arrayBuffer = await fileBlob.arrayBuffer();

    var encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv, tagLength: 128 },
      key,
      arrayBuffer
    );

    var encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });

    _debug('File encrypted successfully', encryptedBlob.size, 'bytes');

    return {
      encryptedBlob: encryptedBlob,
      key: keyBase64,
      iv: ivBase64
    };
  }

  async function decryptFile(encryptedBlob, keyBase64, ivBase64, mimeType) {
    _debug('decryptFile called', encryptedBlob.size, mimeType);

    try {
      var key = await _importKey(keyBase64);
      var iv = new Uint8Array(_base64ToArrayBuffer(ivBase64));
      var encryptedBuffer = await encryptedBlob.arrayBuffer();

      var decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv, tagLength: 128 },
        key,
        encryptedBuffer
      );

      var outputType = mimeType || 'application/octet-stream';
      var decryptedBlob = new Blob([decryptedBuffer], { type: outputType });

      _debug('File decrypted successfully', decryptedBlob.size, 'bytes');
      return decryptedBlob;
    } catch (err) {
      _debug('Decryption failed:', err.message);
      return null;
    }
  }

  async function encryptMetadata(metadata, chatId, chatType) {
    _debug('encryptMetadata called', chatId, chatType);

    if (!metadata || typeof metadata !== 'object') {
      return metadata;
    }

    var result = {};
    var keys = Object.keys(metadata);

    for (var i = 0; i < keys.length; i++) {
      result[keys[i]] = metadata[keys[i]];
    }

    if (window.E2E && typeof window.E2E.encryptForChat === 'function') {
      try {
        var serializable = {};
        var metaKeys = ['name', 'caption', 'fileName', 'originalName', 'description'];
        for (var j = 0; j < metaKeys.length; j++) {
          if (metadata[metaKeys[j]] && typeof metadata[metaKeys[j]] === 'string') {
            serializable[metaKeys[j]] = metadata[metaKeys[j]];
          }
        }

        if (Object.keys(serializable).length > 0) {
          var encrypted = await window.E2E.encryptForChat(
            JSON.stringify(serializable),
            chatId,
            chatType
          );
          result._encMeta = encrypted;
          for (var k = 0; k < metaKeys.length; k++) {
            if (serializable[metaKeys[k]]) {
              result[metaKeys[k]] = undefined;
              delete result[metaKeys[k]];
            }
          }
          _debug('Metadata encrypted via E2E');
        }
      } catch (err) {
        _debug('E2E metadata encryption failed:', err.message);
      }
    } else {
      _debug('E2E not available, metadata stored unencrypted');
    }

    return result;
  }

  async function decryptMetadata(encMetadata, chatId, chatType) {
    _debug('decryptMetadata called', chatId, chatType);

    if (!encMetadata || typeof encMetadata !== 'object') {
      return encMetadata;
    }

    var result = {};
    var keys = Object.keys(encMetadata);

    for (var i = 0; i < keys.length; i++) {
      result[keys[i]] = encMetadata[keys[i]];
    }

    if (encMetadata._encMeta && window.E2E && typeof window.E2E.decryptMessageFor === 'function') {
      try {
        var decrypted = await window.E2E.decryptMessageFor(
          encMetadata._encMeta,
          chatId,
          chatType
        );

        var parsed = JSON.parse(decrypted);
        var metaKeys = Object.keys(parsed);
        for (var j = 0; j < metaKeys.length; j++) {
          result[metaKeys[j]] = parsed[metaKeys[j]];
        }

        delete result._encMeta;
        _debug('Metadata decrypted via E2E');
      } catch (err) {
        _debug('E2E metadata decryption failed:', err.message);
      }
    }

    return result;
  }

  async function prepareForUpload(file, chatId, chatType) {
    _debug('prepareForUpload called', file.name, chatId, chatType);

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds the 100MB limit');
    }

    var mimeType = _getFileType(file);

    if (!_isEncryptableType(mimeType)) {
      _debug('Non-encryptable file type, returning unencrypted');
      return {
        encryptedFile: file,
        encryptedMetadata: {
          name: file.name,
          type: mimeType,
          size: file.size
        },
        encryptionInfo: {
          key: null,
          iv: null,
          encrypted: false
        }
      };
    }

    var fileBlob = new Blob([file], { type: mimeType });

    var encryptionResult = await encryptFile(fileBlob);

    var rawMetadata = {
      name: file.name || 'file',
      fileName: file.name || 'file',
      caption: file.caption || '',
      type: mimeType,
      size: file.size
    };

    var encryptedMetadata = await encryptMetadata(rawMetadata, chatId, chatType);
    encryptedMetadata.originalType = mimeType;

    var encryptionInfo = {
      key: encryptionResult.key,
      iv: encryptionResult.iv,
      encrypted: true
    };

    _debug('prepareForUpload complete', encryptionInfo);

    return {
      encryptedFile: encryptionResult.encryptedBlob,
      encryptedMetadata: encryptedMetadata,
      encryptionInfo: encryptionInfo
    };
  }

  async function processDownload(messageData) {
    _debug('processDownload called');

    try {
      if (!messageData) {
        throw new Error('No message data provided');
      }

      var encInfo = messageData.encryptionInfo || messageData.encryption;
      var mimeType = (messageData.encryptedMetadata && messageData.encryptedMetadata.originalType)
        || messageData.type
        || 'application/octet-stream';

      if (!encInfo || !encInfo.encrypted) {
        _debug('Message not encrypted, returning raw data');
        var rawBlob = messageData.blob || messageData.file;
        if (!rawBlob) {
          throw new Error('No file data available');
        }
        var url = URL.createObjectURL(rawBlob);
        return {
          blob: rawBlob,
          url: url,
          name: (messageData.encryptedMetadata && messageData.encryptedMetadata.name) || messageData.name || 'file',
          type: mimeType
        };
      }

      if (!encInfo.key || !encInfo.iv) {
        throw new Error('Missing encryption key or IV');
      }

      var encryptedBlob = messageData.blob || messageData.file;
      if (!encryptedBlob) {
        throw new Error('No encrypted file data available');
      }

      if (encryptedBlob instanceof ArrayBuffer) {
        encryptedBlob = new Blob([encryptedBlob], { type: 'application/octet-stream' });
      }

      var decryptedBlob = await decryptFile(encryptedBlob, encInfo.key, encInfo.iv, mimeType);

      if (!decryptedBlob) {
        throw new Error('Decryption returned null');
      }

      var objectUrl = URL.createObjectURL(decryptedBlob);

      var fileName = 'file';
      if (messageData.encryptedMetadata && messageData.encryptedMetadata.name) {
        fileName = messageData.encryptedMetadata.name;
      } else if (messageData.name) {
        fileName = messageData.name;
      }

      _debug('processDownload complete', decryptedBlob.size, 'bytes');

      return {
        blob: decryptedBlob,
        url: objectUrl,
        name: fileName,
        type: mimeType
      };
    } catch (err) {
      _debug('processDownload failed:', err.message);
      return null;
    }
  }

  window.MediaEncryption = {
    encryptFile: encryptFile,
    decryptFile: decryptFile,
    encryptMetadata: encryptMetadata,
    decryptMetadata: decryptMetadata,
    prepareForUpload: prepareForUpload,
    processDownload: processDownload,
    _arrayBufferToBase64: _arrayBufferToBase64,
    _base64ToArrayBuffer: _base64ToArrayBuffer,
    _getFileType: _getFileType,
    _isEncryptableType: _isEncryptableType
  };
})();
