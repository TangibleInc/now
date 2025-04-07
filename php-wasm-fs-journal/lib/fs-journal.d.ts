import { PHP, UniversalPHP } from '@php-wasm/universal';
export type EmscriptenFS = any;
/**
 * Represents a stream in the Emscripten file system.
 */
export type EmscriptenFSStream = {
    /** The path of the node associated with this stream. */
    path: string;
    /** The node associated with the stream. */
    node: EmscriptenFSNode;
};
/**
 * Represents a node in the Emscripten file system.
 */
export type EmscriptenFSNode = {
    /**
     * The name of the file or directory.
     */
    name: string;
    /**
     * A binary flag encoding information about this note,
     * e.g. whether it's file or a directory.
     */
    mode: number;
    /**
     * A dictionary of functions representing operations
     * that can be performed on the node.
     */
    node_ops: any;
};
/**
 * Represents the type of node in PHP file system.
 */
export type FSNodeType = 'file' | 'directory';
/**
 * Represents an update operation on a file system node.
 */
export type UpdateFileOperation = {
    /** The type of operation being performed. */
    operation: 'WRITE';
    /** The path of the node being updated. */
    path: string;
    /** Optional. The new contents of the file. */
    data?: Uint8Array;
    nodeType: 'file';
};
/**
 * Represents a directory operation.
 */
export type CreateOperation = {
    /** The type of operation being performed. */
    operation: 'CREATE';
    /** The path of the node being created. */
    path: string;
    /** The type of the node being created. */
    nodeType: FSNodeType;
};
export type DeleteOperation = {
    /** The type of operation being performed. */
    operation: 'DELETE';
    /** The path of the node being updated. */
    path: string;
    /** The type of the node being updated. */
    nodeType: FSNodeType;
};
/**
 * Represents a rename operation on a file or directory in PHP file system.
 */
export type RenameOperation = {
    /** The type of operation being performed. */
    operation: 'RENAME';
    /** The original path of the file or directory being renamed. */
    path: string;
    /** The new path of the file or directory after the rename operation. */
    toPath: string;
    /** The type of node being renamed (file or directory). */
    nodeType: FSNodeType;
};
/**
 * Represents a node in the file system.
 */
export type FSNode = {
    /** The name of this file or directory. */
    name: string;
    /** The type of this node (file or directory). */
    type: FSNodeType;
    /** The contents of the file, if it is a file and it's stored in memory. */
    contents?: string;
    /** The child nodes of the directory, if it is a directory. */
    children?: FSNode[];
};
export type FilesystemOperation = CreateOperation | UpdateFileOperation | DeleteOperation | RenameOperation;
export declare function journalFSEvents(php: PHP, fsRoot: string, onEntry?: (entry: FilesystemOperation) => void): () => any;
/**
 * Replays a list of filesystem operations on a PHP instance.
 *
 * @param php
 * @param entries
 */
export declare function replayFSJournal(php: PHP, entries: FilesystemOperation[]): void;
export declare function recordExistingPath(php: PHP, fromPath: string, toPath: string): Generator<FilesystemOperation>;
/**
 * Normalizes a list of filesystem operations to remove
 * redundant operations.
 *
 * This is crucial because the journal doesn't store the file contents
 * on write, but only the information that the write happened. We only
 * read the contents of the file on flush. However, at that time the file
 * could have been moved to another location so we need this function to
 * rewrite the journal to reflect the current file location. Only then
 * will the hydrateUpdateFileOps() function be able to do its job.
 *
 * @param journal The original journal.
 * @returns The normalized journal.
 */
export declare function normalizeFilesystemOperations(journal: FilesystemOperation[]): FilesystemOperation[];
/**
 * Populates each WRITE operation with the contents of
 * said file.
 *
 * Mutates the original array.
 *
 * @param php
 * @param entries
 */
export declare function hydrateUpdateFileOps(php: UniversalPHP, entries: FilesystemOperation[]): Promise<FilesystemOperation[]>;
