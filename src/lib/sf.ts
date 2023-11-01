import { Connection } from '@salesforce/core';
import { Record } from 'jsforce';
import { pollForResult } from './polling';

interface ApexTestRunResultRecord extends Record {
  Status: string;
  TestTime: number;
  ClassesCompleted: number;
  ClassesEnqueued: number;
  EndTime: number;
  MethodsEnqueued: number;
  MethodsFailed: number;
}

interface ContainerAsyncRequestRecord extends Record {
  State: string;
  ErrorMsg: string;
  DeployDetails: string;
}

export interface ApexClassRecord extends Record {
  Name: string;
  Body: string;
}
export async function getApexClasses(conn: Connection, classes: string[]): Promise<ApexClassRecord[]> {
  const res = await conn.tooling.query<ApexClassRecord>(
    `SELECT Id, Name, Body FROM ApexClass WHERE Name IN (${classes
      .map((c) => `'${c}'`)
      .join(',')}) AND ManageableState = 'unmanaged'`,
  );
  return res.records;
}

export async function executeTests(
  conn: Connection,
  testClasses: string[],
  timeoutMs: number,
): Promise<ApexTestRunResultRecord> {
  const asyncJobId = await conn.tooling.runTestsAsynchronous({ classNames: testClasses.join(',') });

  return pollForResult({
    timeout: timeoutMs,
    actionName: `TestClasses:${testClasses[0]}`,
    action: async () => {
      const request = await conn.tooling.query<ApexTestRunResultRecord>(
        `SELECT Id, Status, TestTime, ClassesCompleted, ClassesEnqueued, EndTime, MethodsEnqueued, MethodsFailed FROM ApexTestRunResult WHERE AsyncApexJobId = '${asyncJobId}'`,
      );
      if (!['Queued', 'Processing'].includes(request.records[0].Status)) {
        return request.records[0];
      }
    },
  });
}

export async function writeApexClassesToOrg(
  conn: Connection,
  classId: string,
  body: string,
  timeoutMs: number,
): Promise<ContainerAsyncRequestRecord> {
  const mdContainer = await conn.tooling.create('MetadataContainer', {
    Name: 'WarpIt' + `${new Date().getTime()}`,
  });
  await conn.tooling.create('ApexClassMember', {
    ContentEntityId: classId,
    MetadataContainerId: mdContainer.id,
    Body: body,
  });
  const requestSaveResult = await conn.tooling.create('ContainerAsyncRequest', {
    IsCheckOnly: false,
    MetadataContainerId: mdContainer.id,
  });
  return pollForResult({
    timeout: timeoutMs,
    action: async () => {
      const request = await conn.tooling.query<ContainerAsyncRequestRecord>(
        `SELECT Id, State, ErrorMsg, DeployDetails FROM ContainerAsyncRequest WHERE Id = '${requestSaveResult.id}'`,
      );
      if (!(request.records[0].State === 'Queued')) {
        return request.records[0];
      }
    },
    actionName: `WriteClass:${classId}`,
  });
}
