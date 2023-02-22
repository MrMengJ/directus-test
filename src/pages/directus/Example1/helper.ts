import {
  concat,
  filter,
  findIndex,
  forEach,
  groupBy,
  head,
  includes,
  isEmpty,
  last,
  map,
  sortBy,
  find,
  uniq,
} from "lodash";
import { IKeyValue } from "@/types";
import { IDataNode } from "@/components/Tree/interface";

//扁平化数组转tree
export const ROOT_TREE_ID = 0;
export const ROOT_PARENT_ID = "root";
export const ROOT_TYPE = "root";

interface IArrayToTree {
  flatData: any;
  getKey?: (node: IKeyValue) => string;
  getParentKey?: (node: IKeyValue) => string;
  rootKey?: string | number;
}

export function arrayToTree({
  flatData,
  getKey = (node) => node.id,
  getParentKey = (node) => node.parentId,
  rootKey = ROOT_TREE_ID,
}: IArrayToTree): IKeyValue[] {
  if (!flatData) {
    return [];
  }

  const getChildrenToParents = (flatData) => {
    const childrenToParents = {};
    forEach(flatData, (child) => {
      const parentKey = getParentKey(child);
      if (parentKey in childrenToParents) {
        childrenToParents[parentKey].push(child);
      } else {
        childrenToParents[parentKey] = [child];
      }
    });
    return childrenToParents;
  };

  const childrenToParents = getChildrenToParents(flatData);

  if (!(rootKey in childrenToParents)) {
    return [];
  }

  const getChildNodes = (parentKey, childrenToParents) => {
    if (parentKey === ROOT_TREE_ID) {
      const latestChildrenToParents = getChildrenToParents(
        childrenToParents[parentKey]
      );
      return sortBy(
        map(latestChildrenToParents[parentKey], (child) => trav(child)),
        "sortId"
      );
    } else {
      return sortBy(
        map(childrenToParents[parentKey], (child) => trav(child)),
        "sortId"
      );
    }
  };

  const trav = (parent) => {
    const parentKey = getKey(parent);
    if (parentKey in childrenToParents) {
      return {
        ...parent,
        children: getChildNodes(parentKey, childrenToParents),
      };
    }

    return parent;
  };

  return sortBy(
    map(childrenToParents[rootKey], (child) => trav(child)),
    "sortId"
  );
}
