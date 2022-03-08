import { CustomError } from '@monorepo/common';
import * as _ from 'lodash-es';
import * as k8sActions from '../../app/redux/actions/k8s';
import type { K8sModelCommon } from '../../types/k8s';
import { getReferenceForModel } from '../k8s-utils';
import type { GetWatchData, MakeQuery, Query } from './k8s-watch-types';
import type { WatchK8sResource } from './watch-resource-types';

export class NoModelError extends CustomError {
  constructor() {
    super('Model does not exist');
  }
}

export const makeReduxID = (k8sKind: K8sModelCommon, query: Query, cluster?: string) => {
  let queryString = '';
  if (!_.isEmpty(query)) {
    queryString = `---${JSON.stringify(query)}`;
  }

  return `${cluster ?? 'local-cluster'}${getReferenceForModel(k8sKind)}${queryString}`;
};

export const makeQuery: MakeQuery = (namespace, labelSelector, fieldSelector, name, limit) => {
  const query: Query = {};

  if (!_.isEmpty(labelSelector)) {
    query.labelSelector = labelSelector;
  }

  if (!_.isEmpty(namespace)) {
    query.ns = namespace;
  }

  if (!_.isEmpty(name)) {
    query.name = name;
  }

  if (fieldSelector) {
    query.fieldSelector = fieldSelector;
  }

  if (limit) {
    query.limit = limit;
  }
  return query;
};

export const INTERNAL_REDUX_IMMUTABLE_TOJSON_CACHE_SYMBOL = Symbol('_cachedToJSResult');

/* TODO: Fix ignores in getReduxData -- this is likely a refactor of the method */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const getReduxData = (immutableData, resource: WatchK8sResource) => {
  if (!immutableData) {
    return null;
  }
  if (resource.isList) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return immutableData.toArray().map((a) => {
      if (!a[INTERNAL_REDUX_IMMUTABLE_TOJSON_CACHE_SYMBOL]) {
        // eslint-disable-next-line no-param-reassign
        a[INTERNAL_REDUX_IMMUTABLE_TOJSON_CACHE_SYMBOL] = a.toJSON();
      }
      return a[INTERNAL_REDUX_IMMUTABLE_TOJSON_CACHE_SYMBOL];
    });
  }
  if (immutableData.toJSON) {
    if (!immutableData[INTERNAL_REDUX_IMMUTABLE_TOJSON_CACHE_SYMBOL]) {
      // eslint-disable-next-line no-param-reassign
      immutableData[INTERNAL_REDUX_IMMUTABLE_TOJSON_CACHE_SYMBOL] = immutableData.toJSON();
    }
    return immutableData[INTERNAL_REDUX_IMMUTABLE_TOJSON_CACHE_SYMBOL];
  }
  return null;
};

export const getWatchData: GetWatchData = (resource, k8sModel, cluster) => {
  if (!k8sModel || !resource || !resource.name || !resource.namespace) {
    return null;
  }
  const query = makeQuery(
    resource.namespace,
    resource.selector,
    resource.fieldSelector,
    resource.name,
    resource.limit,
  );
  const targetCluster = resource.cluster ?? cluster;
  if (!targetCluster) {
    return null;
  }

  const id = makeReduxID(k8sModel, query, targetCluster);
  const action = resource.isList
    ? k8sActions.watchK8sList(
        id,
        { ...query, cluster: targetCluster },
        k8sModel,
        undefined,
        resource.partialMetadata,
      )
    : k8sActions.watchK8sObject(
        id,
        resource.name,
        resource.namespace,
        { ...query, cluster: targetCluster },
        k8sModel,
        resource.partialMetadata,
      );
  return { id, action };
};
