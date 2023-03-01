import React, { useCallback, useMemo, useRef, useState } from "react";
import { Button, Spin, Tree, TreeSelect } from "antd";
import { Directus, Filter, IAuth, TypeMap } from "@directus/sdk";
import { useAsyncEffect, useMemoizedFn } from "ahooks";
import styled from "styled-components";
import { filter, forEach, groupBy, isEmpty, isNull, map, uniq } from "lodash";
import dayjs from "dayjs";
import dynamic from "next/dynamic";
import { ColumnConfig, PlotEvent } from "@ant-design/plots";

import { arrayToTree } from "@/pages/directus/Example1/helper";

const Column = dynamic(
  () => import("@ant-design/plots").then(({ Column }) => Column),
  { ssr: false }
);
const DualAxes = dynamic(
  () => import("@ant-design/plots").then(({ DualAxes }) => DualAxes),
  { ssr: false }
);
const Line = dynamic(
  () => import("@ant-design/plots").then(({ Line }) => Line),
  { ssr: false }
);

const Wrapper = styled.div``;

const SearchWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 200px;
`;

const ChartWrapper = styled.div`
  display: flex;
  align-items: center;
  padding-bottom: 40px;
`;

const Box = styled.div`
  width: 300px;
  margin: 10px;
`;

type IKeyValue<T = any> = {
  [key: string]: T;
};

type IFlowOrg = {
  GUID: string; // 主键
  PER_ORG_ID: number;
  ORG_ID: number;
  ORG_NAME: string;
  ORG_NUMBER: number;
  SORT_ID: number;
  T_PATH: string;
};

type IFlowStructure = {
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

type IFlowStructureH = IFlowStructure & {
  GUID: string; // 主键
  release_status: number;
};

type MyCollections = {
  jecn_flow_structure: IFlowStructure;
  jecn_flow_structure_h: IFlowStructureH;
  jecn_flow_org: IFlowOrg;
};

const ReleaseStatusMapLabel = {
  0: "新增",
  1: "修订",
  2: "废止",
};

function Example1() {
  const directusRef = useRef<Directus<MyCollections, IAuth>>();
  const [isLoginSuccess, setIsLoginSuccess] = useState(false);
  const [allFlows, setAllFlows] = useState<IFlowStructure[] | null>(null);
  const [allOrgs, setAllOrgs] = useState<IFlowOrg[] | null>(null);
  const [includeSubFlows, setIncludeSubFlows] = useState(true);
  const [includeSubOrgs, setIncludeSubOrgs] = useState(true);
  const [selectedArchitectureIds, setSelectedArchitectureIds] = useState<
    string[]
  >([]);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [searchedFlows, setSearchedFlows] = useState<IFlowStructureH[] | null>(
    null
  );
  const [flowPubDetails, setFlowPubDetails] = useState<IKeyValue[]>([]);
  const [orgPubDetails, setOrgPubDetails] = useState<IKeyValue[]>([]);

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

      const FlowStructure = directus.items("jecn_flow_structure");
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
      setAllFlows(allFlows.data || []);
      setAllOrgs(allOrgs.data || []);
    }
  }, []);

  const getPubTimeLabel = (pubTime: Date) => {
    const year = dayjs(pubTime).year();
    const month = dayjs(pubTime).month() + 1;
    return `${year}年${month}月`;
  };

  const handleFlowTreeChange = (newValue: { value: string }[]) => {
    setSelectedArchitectureIds(newValue.map((item) => item.value));
  };

  const handleOrgTreeChange = (newValue: { value: string }[]) => {
    setSelectedOrgIds(newValue.map((item) => item.value));
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

  /**
   * 获取选中的架构有效path字段数据集合
   * @param selectedFlows
   * @return paths[]
   */
  const getValidStartPaths = (selectedFlows: IFlowStructure[] | IFlowOrg[]) => {
    const result: IFlowStructure["T_PATH"][] = [];
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

  const getFetchOrgsFilterQuery = (): Filter<IFlowOrg> => {
    const selectedOrgs = filter(allOrgs, (item) =>
      selectedArchitectureIds.includes(item.ORG_ID.toString())
    );
    const startPaths = isEmpty(selectedOrgs)
      ? Object.keys(statisticalOrgsByPath)
      : selectedOrgs.map((item) => item.T_PATH);

    return {
      _or: startPaths.map((path) => {
        return {
          T_PATH: includeSubOrgs
            ? {
                _starts_with: path,
              }
            : {
                _eq: path,
              },
        };
      }),
    };
  };

  const getFetchFlowsFilterQuery = (
    orgs: IFlowOrg[] | null
  ): Filter<IFlowStructureH> => {
    const selectedArchitectures = filter(allFlows, (item) =>
      selectedArchitectureIds.includes(item.FLOW_ID.toString())
    );
    const startPaths = isEmpty(selectedArchitectures)
      ? Object.keys(statisticalFlowsByPath)
      : selectedArchitectures.map((item) => item.T_PATH);

    const result: Filter<IFlowStructureH> = {
      _and: [
        {
          _or: startPaths.map((path) => {
            return {
              T_PATH: includeSubFlows
                ? {
                    _starts_with: path,
                  }
                : {
                    _eq: path,
                  },
            };
          }),
        },
        // {
        //   PUB_TIME: {
        //     _gte: new Date("2022-12-13T12:00:00"),
        //   },
        // },
        // {
        //   CONFIDENTIALITY_LEVEL: {
        //     _eq: 1,
        //   },
        // },
      ],
    };

    if (!isNull(orgs)) {
      result._and.unshift({
        ORG_ID: {
          _in: orgs.map((org) => org.ORG_ID),
        },
      });
    }

    return result;
  };

  const handleSearch = async () => {
    const directus = directusRef.current;
    if (directus && isLoginSuccess) {
      const FlowStructureH = directus.items("jecn_flow_structure_h");
      const FlowOrg = directus.items("jecn_flow_org");

      if (isEmpty(selectedOrgIds)) {
        const flowsReponse = await FlowStructureH.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
          filter: getFetchFlowsFilterQuery(null),
        });
        const searchedFlows = flowsReponse.data as (IFlowStructureH & {
          org?: IFlowOrg;
        })[];
        const relatedOrgIds = uniq(searchedFlows?.map((item) => item.ORG_ID));
        const orgsResponse = await FlowOrg.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
          filter: {
            ORG_ID: {
              _in: relatedOrgIds,
            },
          },
        });
        const searchedOrgs = orgsResponse.data as IFlowOrg[];
        for (let i = 0, length = searchedFlows.length; i < length; i++) {
          const flow = searchedFlows[i];
          for (let j = 0, length = searchedOrgs.length; j < length; j++) {
            const org = searchedOrgs[j];
            if (flow.ORG_ID === org.ORG_ID) {
              flow.org = org;
            }
          }
        }

        setSearchedFlows(searchedFlows);
      } else {
        const orgsResponse = await FlowOrg.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
          filter: getFetchOrgsFilterQuery(),
        });
        const flowsResponse = await FlowStructureH.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
          filter: getFetchFlowsFilterQuery(orgsResponse.data as IFlowOrg[]),
        });
        const searchedFlows = flowsResponse.data as (IFlowStructureH & {
          org?: IFlowOrg;
        })[];
        const searchedOrgs = orgsResponse.data as IFlowOrg[];
        for (let i = 0, length = searchedFlows.length; i < length; i++) {
          const flow = searchedFlows[i];
          for (let j = 0, length = searchedOrgs.length; j < length; j++) {
            const org = searchedOrgs[j];
            if (flow.ORG_ID === org.ORG_ID) {
              flow.org = org;
            }
          }
        }

        setSearchedFlows(searchedFlows);
      }
    }
  };

  const handleDownload = () => {
    console.log("column1Data", column1Data);
    console.log("column2Data", column2Data);
    console.log("flowPubDetails", flowPubDetails);
    console.log("dualAxes1LineData", dualAxes1LineData);
    console.log("orgPubDetails", orgPubDetails);
    console.log("dualAxes2LineData", dualAxes2LineData);
  };

  const statisticalFlowsByPath = useMemo(() => {
    if (isNull(allFlows)) {
      return {};
    }

    const result: IKeyValue<IFlowStructure> = {};
    if (isEmpty(selectedArchitectureIds)) {
      for (let i = 0, length = allFlows.length; i < length; i++) {
        const item = allFlows[i];
        const isRootNode = item.PRE_FLOW_ID === 0;
        if (isRootNode) {
          result[item.T_PATH] = item;
        }
      }
    } else {
      for (let i = 0, length = allFlows.length; i < length; i++) {
        const item = allFlows[i];
        if (selectedArchitectureIds.includes(item.FLOW_ID.toString())) {
          result[item.T_PATH] = item;
        }
      }
    }

    return result;
  }, [allFlows, selectedArchitectureIds]);

  const statisticalOrgsByPath = useMemo(() => {
    if (isNull(allOrgs)) {
      return {};
    }

    const result: IKeyValue<IFlowOrg> = {};
    if (isEmpty(selectedOrgIds)) {
      for (let i = 0, length = allOrgs.length; i < length; i++) {
        const item = allOrgs[i];
        const isRootNode = item.PER_ORG_ID === 0;
        if (isRootNode) {
          result[item.T_PATH] = item;
        }
      }
    } else {
      for (let i = 0, length = allOrgs.length; i < length; i++) {
        const item = allOrgs[i];
        if (selectedOrgIds.includes(item.ORG_ID.toString())) {
          result[item.T_PATH] = item;
        }
      }
    }

    return result;
  }, [allOrgs, selectedOrgIds]);

  const column1Data = useMemo(() => {
    if (!searchedFlows) {
      return [];
    }

    const statisticalFlows = map(statisticalFlowsByPath, (item, path) => {
      const { FLOW_ID, FLOW_NAME } = item;
      return {
        flowId: FLOW_ID,
        flowName: FLOW_NAME,
        flows: [],
        path: path,
      } as {
        flowId: number;
        flowName: string;
        flows: (IFlowStructureH & { pubTimeLabel: string })[];
        path: string;
      };
    });
    for (let i = 0, length = searchedFlows.length; i < length; i++) {
      const flow = searchedFlows[i];
      for (let j = 0, length = statisticalFlows.length; j < length; j++) {
        if (flow.T_PATH.startsWith(statisticalFlows[j].path)) {
          const pubTimeLabel = getPubTimeLabel(flow.PUB_TIME);
          statisticalFlows[j].flows.push({ ...flow, pubTimeLabel });
        }
      }
    }

    const result = [];
    for (let i = 0, length = statisticalFlows.length; i < length; i++) {
      const item = statisticalFlows[i];
      const { flows } = item;
      if (isEmpty(flows)) {
        result.push({
          flowId: item.flowId,
          ancestorFlowId: item.flowId,
          ancestorFlowName: item.flowName,
          pubCount: 0,
        });
      } else {
        forEach(groupBy(flows, "FLOW_ID"), (flows, flowId) => {
          forEach(groupBy(flows, "pubTimeLabel"), (flows, pubTimeLabel) => {
            forEach(
              groupBy(flows, "release_status"),
              (flows, releaseStatus) => {
                result.push({
                  flowId: flowId,
                  ancestorFlowId: item.flowId,
                  ancestorFlowName: item.flowName,
                  pubTimeLabel: pubTimeLabel,
                  releaseStatus: releaseStatus,
                  releaseStatusLabel: ReleaseStatusMapLabel[releaseStatus],
                  pubCount: flows.length,
                });
              }
            );
          });
        });
      }
    }

    return result;
  }, [searchedFlows]);

  const column2Data = useMemo(() => {
    if (!searchedFlows) {
      return [];
    }

    const statisticalOrgs = map(statisticalOrgsByPath, (item, path) => {
      const { ORG_ID, ORG_NAME } = item;
      return {
        orgId: ORG_ID,
        orgName: ORG_NAME,
        flows: [],
        path: path,
      } as {
        orgId: number;
        orgName: string;
        flows: (IFlowStructureH & { pubTimeLabel: string })[];
        path: string;
      };
    });
    forEach(groupBy(searchedFlows, "org.T_PATH"), (groupItem, path) => {
      for (let j = 0, length = statisticalOrgs.length; j < length; j++) {
        if (path.startsWith(statisticalOrgs[j].path)) {
          statisticalOrgs[j].flows.push(
            ...map(groupItem, (item) => ({
              ...item,
              pubTimeLabel: getPubTimeLabel(item.PUB_TIME),
            }))
          );
        }
      }
    });

    const result = [];
    for (let i = 0, length = statisticalOrgs.length; i < length; i++) {
      const item = statisticalOrgs[i];
      const { flows } = item;
      if (isEmpty(flows)) {
        result.push({
          orgId: item.orgId,
          orgName: item.orgName,
          pubCount: 0,
        });
      } else {
        forEach(groupBy(flows, "FLOW_ID"), (flows, flowId) => {
          forEach(groupBy(flows, "pubTimeLabel"), (flows, pubTimeLabel) => {
            forEach(
              groupBy(flows, "release_status"),
              (flows, releaseStatus) => {
                result.push({
                  flowId: flowId,
                  orgId: item.orgId,
                  orgName: item.orgName,
                  pubTimeLabel: pubTimeLabel,
                  releaseStatus: releaseStatus,
                  releaseStatusLabel: ReleaseStatusMapLabel[releaseStatus],
                  pubCount: flows.length,
                });
              }
            );
          });
        });
      }
    }

    return result;
  }, [searchedFlows]);

  const onColumn1Ready: ColumnConfig["onReady"] = useMemoizedFn((plot) => {
    plot.on("element:click", (evt: PlotEvent) => {
      const { x, y, view } = evt;
      const tooltipData = view.getTooltipItems({ x, y });
      setFlowPubDetails(tooltipData.map((item) => item.data));
    });
  });

  const onColumn2Ready: ColumnConfig["onReady"] = useMemoizedFn((plot) => {
    plot.on("element:click", (evt: PlotEvent) => {
      const { x, y, view } = evt;
      const tooltipData = view.getTooltipItems({ x, y });
      setOrgPubDetails(tooltipData.map((item) => item.data));
    });
  });

  const dualAxes1LineData = useMemo(() => {
    const result: { pubTimeLabel: string; pubCount: number }[] = [];
    forEach(groupBy(flowPubDetails, "pubTimeLabel"), (item, key) => {
      let count = 0;
      forEach(item, (item) => {
        count += item.pubCount;
      });
      result.push({
        pubTimeLabel: key,
        pubCount: count,
      });
    });

    return result;
  }, [flowPubDetails]);

  const dualAxes2LineData = useMemo(() => {
    const result: { pubTimeLabel: string; pubCount: number }[] = [];
    forEach(groupBy(orgPubDetails, "pubTimeLabel"), (item, key) => {
      let count = 0;
      forEach(item, (item) => {
        count += item.pubCount;
      });
      result.push({
        pubTimeLabel: key,
        pubCount: count,
      });
    });

    return result;
  }, [orgPubDetails]);

  const dualAxesLegend: ColumnConfig["legend"] = useMemo(() => {
    return {
      itemName: {
        formatter: (text) => {
          if (text === "pubCount") {
            return "总计";
          }

          return text;
        },
      },
    };
  }, []);

  if (isEmpty(allFlows) || isEmpty(allOrgs)) {
    return <Spin />;
  }

  return (
    <Wrapper>
      <SearchWrapper>
        <Box>
          流程架构树
          <TreeSelect
            treeData={getFlowTreeData()}
            treeCheckable={true}
            treeCheckStrictly={true}
            style={{ width: "100%" }}
            onChange={handleFlowTreeChange}
          />
        </Box>
        <Box>
          组织树
          <TreeSelect
            treeData={getOrgTreeData()}
            treeCheckable={true}
            treeCheckStrictly={true}
            style={{ width: "100%" }}
            onChange={handleOrgTreeChange}
          />
        </Box>
        <Button
          type={"primary"}
          onClick={handleSearch}
          style={{ marginRight: "20px" }}
        >
          查询
        </Button>
        <Button type={"primary"} onClick={handleDownload}>
          下载
        </Button>
      </SearchWrapper>
      <ChartWrapper>
        <Column
          data={column1Data}
          isStack={true}
          xField={"ancestorFlowName"}
          yField={"pubCount"}
          seriesField={"pubTimeLabel"}
          autoFit={true}
          label={{
            position: "middle", // 'top', 'bottom', 'middle'
          }}
          xAxis={{
            label: {
              autoHide: true,
            },
          }}
          onReady={onColumn1Ready}
          style={{ marginRight: "20px", flex: 1 }}
        />
        <DualAxes
          data={[flowPubDetails, dualAxes1LineData]}
          xField={"pubTimeLabel"}
          yField={["pubCount", "pubCount"]}
          legend={dualAxesLegend}
          autoFit={true}
          geometryOptions={[
            {
              geometry: "column",
              isStack: true,
              seriesField: "releaseStatusLabel",
              label: {
                position: "middle", // 'top', 'bottom', 'middle'
              },
            },
            {
              geometry: "line",
              isStack: true,
              label: {
                position: "middle", // 'top', 'bottom', 'middle'
              },
            },
          ]}
          style={{ flex: 1 }}
        />
      </ChartWrapper>
      <ChartWrapper>
        <Column
          data={column2Data}
          isStack={true}
          xField={"orgName"}
          yField={"pubCount"}
          seriesField={"pubTimeLabel"}
          label={{
            position: "middle", // 'top', 'bottom', 'middle'
          }}
          autoFit={true}
          onReady={onColumn2Ready}
          style={{ marginRight: "20px", flex: 1 }}
        />
        <DualAxes
          data={[orgPubDetails, dualAxes2LineData]}
          xField={"pubTimeLabel"}
          yField={["pubCount", "pubCount"]}
          legend={dualAxesLegend}
          autoFit={true}
          geometryOptions={[
            {
              geometry: "column",
              isStack: true,
              seriesField: "releaseStatusLabel",
              // label: {
              //   position: "middle", // 'top', 'bottom', 'middle'
              // },
            },
            {
              geometry: "line",
              isStack: true,
              // label: {
              //   position: "middle", // 'top', 'bottom', 'middle'
              // },
            },
          ]}
          style={{ flex: 1 }}
        />
      </ChartWrapper>
    </Wrapper>
  );
}

export default Example1;
