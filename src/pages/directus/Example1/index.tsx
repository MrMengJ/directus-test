import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Tree, TreeSelect } from "antd";
import { Directus, IAuth, TypeMap } from "@directus/sdk";
import { useAsyncEffect } from "ahooks";
import { arrayToTree } from "@/pages/directus/Example1/helper";
import styled from "styled-components";
import { uniqBy } from "lodash";

const Wrapper = styled.div`
  display: flex;
  align-items: center;
`;

const Box = styled.div`
  width: 300px;
  margin: 10px;
`;

type IFlowOrg = {
  GUID: string; // 主键
  PER_ORG_ID: number;
  ORG_ID: number;
  ORG_NAME: string;
  ORG_NUMBER: number;
  SORT_ID: number;
  T_PATH: string;
};

type IFlowStructureH = {
  GUID: string; // 主键
  PRE_FLOW_ID: number;
  FLOW_ID: number;
  FLOW_NAME: string;
  IS_FLOW: number;
  SORT_ID: number;
  T_PATH: string;
  ORG_ID: number;
  ORG_NAME: string;
  PUB_TIME: Date;
  CONFIDENTIALITY_LEVEL: number;
};

type MyCollections = {
  jecn_flow_structure_h: IFlowStructureH;
  jecn_flow_org: IFlowOrg;
};

function Example1() {
  const directusRef = useRef<Directus<MyCollections, IAuth>>();
  const [isLoginSuccess, setIsLoginSuccess] = useState(false);
  const [allFlows, setAllFlows] = useState<IFlowStructureH[] | null>(null);
  const [allOrgs, setAllOrgs] = useState<IFlowOrg[] | null>(null);
  const [selectedFlowIds, setSelectedFlowIds] = useState<string[]>([]);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);

  const createDirectusInstance = () =>
    new Directus<MyCollections>("http://124.221.178.98:30788");

  useAsyncEffect(async () => {
    if (!directusRef.current) {
      directusRef.current = createDirectusInstance();
      const directus = directusRef.current;
      await directus.auth.login({
        email: "admin@jecn.com",
        password: "jecn@123",
      });

      const FlowStructure = directus.items("jecn_flow_structure_h");
      const OrgStructure = directus.items("jecn_flow_org");

      const [allFlows, allOrgs] = [
        await FlowStructure.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
        }),
        await OrgStructure.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
        }),
      ];
      setIsLoginSuccess(true);
      setAllFlows(uniqBy(allFlows.data, "FLOW_ID") || []);
      setAllOrgs(uniqBy(allOrgs.data, "ORG_ID") || []);
    }
  }, []);

  /**
   * 获取选中的架构有效path字段数据集合
   * @param selectedFlows
   * @return paths[]
   */
  const getValidStartPaths = (
    selectedFlows: IFlowStructureH[] | IFlowOrg[]
  ) => {
    const result: IFlowStructureH["T_PATH"][] = [];
    for (let i = 0; i < selectedFlows.length; i++) {
      const thePath = selectedFlows[i].T_PATH;
      let isValid = true;
      for (let j = 0; i < result.length; j++) {
        if (thePath.startsWith(result[j])) {
          isValid = false;
          break;
        } else if (result[j].startsWith(thePath)) {
          result.splice(j, 1);
          break;
        }
      }
      if (isValid) {
        result.push(thePath);
      }
    }

    return result;
  };

  const handleSearch = async () => {
    const directus = directusRef.current;
    if (directus && isLoginSuccess) {
      const FlowStructure = directus.items("jecn_flow_structure_h");
      const allRootFlows = await FlowStructure.readByQuery({
        limit: -1,
        sort: ["SORT_ID"],
        filter: {
          PRE_FLOW_ID: 0,
        },
      });
      // console.log("allRootFlows", allRootFlows);
      const selectedArchitectures = allRootFlows.data?.slice(0, 3) || [];
      const startPaths = getValidStartPaths(selectedArchitectures);
      const allChildrenProcess = await FlowStructure.readByQuery({
        limit: -1,
        sort: ["SORT_ID"],
        filter: {
          _or: startPaths.map((path) => {
            return {
              _and: [
                {
                  T_PATH: {
                    _starts_with: path,
                  },
                },
                {
                  T_PATH: {
                    _neq: path,
                  },
                },
              ],
            };
          }),
        },
      });
      // console.log("allChildrenProcess", allChildrenProcess);

      const FlowOrg = directus.items("jecn_flow_org");

      const allRootOrgs = await FlowOrg.readByQuery({
        limit: -1,
        sort: ["SORT_ID"],
        filter: {
          PER_ORG_ID: 0,
        },
      });
      const selectedOrgs = allRootOrgs.data?.slice(0, 3) || [];
      const orgStartPaths = getValidStartPaths(selectedOrgs);

      const allChildrenOrgs = await FlowOrg.readByQuery({
        limit: -1,
        sort: ["SORT_ID"],
        filter: {
          _or: orgStartPaths.map((path) => {
            return {
              _and: [
                {
                  T_PATH: {
                    _starts_with: path,
                  },
                },
                {
                  T_PATH: {
                    _neq: path,
                  },
                },
              ],
            };
          }),
        },
      });

      const allFlowGuids =
        allChildrenProcess.data?.map((item) => item.GUID) || [];
      const allFlowIds =
        allChildrenProcess.data?.map((item) => item.FLOW_ID) || [];
      const allRelationalOrgIds =
        allChildrenOrgs.data?.map((org) => org.ORG_ID) || [];
      const result = await FlowStructure.readMany(allFlowGuids, {
        limit: -1,
        sort: ["SORT_ID"],
        filter: {
          _and: [
            {
              ORG_ID: {
                _in: allRelationalOrgIds,
              },
            },
            {
              PUB_TIME: {
                _gte: new Date("2022-12-13T12:00:00"),
              },
            },
            {
              CONFIDENTIALITY_LEVEL: {
                _eq: 1,
              },
            },
          ],
        },
      });
    }
  };

  const handleFlowTreeChange = (newValue: string[]) => {
    setSelectedFlowIds(newValue);
  };

  const handleOrgTreeChange = (newValue: string[]) => {
    setSelectedOrgIds(newValue);
  };

  const getFlowTreeData = useCallback(() => {
    const transformedFlows = (allFlows || []).map((item) => {
      return {
        key: item.FLOW_ID.toString(),
        value: item.FLOW_ID.toString(),
        title: item.FLOW_NAME,
        parentId: item.PRE_FLOW_ID.toString(),
      };
    });
    return arrayToTree({
      flatData: transformedFlows,
      getKey: (item) => {
        return item.key;
      },
      getParentKey: (item) => {
        return item.parentId;
      },
    });
  }, [allFlows]);

  const getOrgTreeData = useCallback(() => {
    const transformedOrgs = (allOrgs || []).map((item) => {
      return {
        key: item.ORG_ID.toString(),
        value: item.ORG_ID.toString(),
        title: item.ORG_NAME,
        parentId: item.PER_ORG_ID.toString(),
      };
    });
    return arrayToTree({
      flatData: transformedOrgs,
      getKey: (item) => {
        return item.key;
      },
      getParentKey: (item) => {
        return item.parentId;
      },
    });
  }, [allOrgs]);

  return (
    <Wrapper>
      <Box>
        流程架构树
        <TreeSelect
          treeData={getFlowTreeData()}
          treeCheckable={true}
          style={{ width: "100%" }}
          onChange={handleFlowTreeChange}
        />
      </Box>
      <Box>
        组织树
        <TreeSelect
          treeData={getOrgTreeData()}
          treeCheckable={true}
          style={{ width: "100%" }}
          onChange={handleOrgTreeChange}
        />
      </Box>
      <Button type={"primary"} onClick={handleSearch}>
        查询
      </Button>
    </Wrapper>
  );
}

export default Example1;
