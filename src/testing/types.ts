export type DiscoveredTestType = 'folder' | 'file' | 'class' | 'test';

export type DiscoveredTestCommon = {
    path: string;
    name: string;
    type_: DiscoveredTestType;
    id_: string;
    runID: string;
};

export type DiscoveredTestItem = DiscoveredTestCommon & {
    lineno: number;
};

export type DiscoveredTestNode = DiscoveredTestCommon & {
    children: (DiscoveredTestNode | DiscoveredTestItem)[];
};

export type DiscoveredTestPayload = {
    cwd: string;
    tests?: DiscoveredTestNode;
    status: 'success' | 'error';
    errors?: string[];
};

export type ExecutionTestPayload = {
    test?: string;
    outcome?: string;
    message?: string;
    traceback?: string;
    subtest?: string;
    duration?: number;
};