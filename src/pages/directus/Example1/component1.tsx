import React, { useCallback, useMemo, useRef, useState } from "react";
import { Button, Spin, TreeSelect } from "antd";
import { Directus, Filter, IAuth } from "@directus/sdk";
import { useAsyncEffect, useMemoizedFn } from "ahooks";
import styled from "styled-components";
import { find, forEach, isEmpty, isNull, isNumber, map, uniq } from "lodash";
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

export type IKeyValue<T = any> = {
  [key: string]: T;
};

export type IFlowOrg = {
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
  ISFLOW: number;
  SORT_ID: number;
  T_PATH: string;
  ORG_ID: number | null;
  ORG_NAME: string | null;
  CONFIDENTIALITY_LEVEL: number | null;
};

type IFlowStructureH = IFlowStructure & {
  GUID: string; // 主键
  PUB_TIME: string;
  release_status: number;
};

type MyCollections = {
  jecn_flow_structure: IFlowStructure;
  jecn_flow_structure_h: IFlowStructureH;
  jecn_flow_org: IFlowOrg;
};

export type ITimeRange = {
  startTime: string;
  endTime: string;
};

type IFlowColumn = {
  flowId: number;
  flowName: string;
  pubTimeLabel: string;
  addCount: number;
  reviseCount: number;
  abolishCount: number;
  totalCount: number;
};

type IOrgColumn = {
  orgId: number;
  orgName: string;
  pubTimeLabel: string;
  addCount: number;
  reviseCount: number;
  abolishCount: number;
  totalCount: number;
};

export const ROOT_NODE_ID = 0;

const FlowType = {
  architecture: 0,
  process: 1,
};

const ReleaseStatus = {
  add: 0,
  revise: 1,
  abolish: 2,
};

const ReleaseStatusMapLabel = {
  0: "新增",
  1: "修订",
  2: "废止",
};

export const getPubTimeLabel = (pubTime: Date | string) => {
  const year = dayjs(pubTime).year();
  const month = dayjs(pubTime).month() + 1;
  return `${year}.${month}`;
};

function Example1() {
  const directusRef = useRef<Directus<MyCollections, IAuth>>();
  const [isLoginSuccess, setIsLoginSuccess] = useState(false);
  const [allFlows, setAllFlows] = useState<IFlowStructure[] | null>(null);
  const [allOrgs, setAllOrgs] = useState<IFlowOrg[] | null>(null);
  const [selectedArchitectures, setSelectedArchitectures] = useState<
    IFlowStructure[]
  >([]);
  const [selectedOrgs, setSelectedOrgs] = useState<IFlowOrg[]>([]);
  const [timeRange, setTimeRange] = useState<ITimeRange>({
    startTime: new Date(
      dayjs().subtract(11, "month").format("YYYY-MM")
    ).toISOString(),
    endTime: new Date().toISOString(),
  }); // 搜索条件中的发布时段
  const [releaseStatus, setReleaseStatus] = useState<number | null>(null); // 搜索条件中的版本类型
  const [confidentialityLevel, setConfidentialityLevel] = useState<
    number | null
  >(null); // 搜索条件中的保密级别

  const [searchedFlows, setSearchedFlows] = useState<
    (IFlowStructureH & { org?: IFlowOrg })[] | null
  >(null);
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

  const handleFlowTreeChange = (newValue: { value: string }[]) => {
    const selectedArchitectures = allFlows!.filter((flow) =>
      find(newValue, (item) => parseInt(item.value) === flow.FLOW_ID)
    );
    setSelectedArchitectures(selectedArchitectures);
  };

  const handleOrgTreeChange = (newValue: { value: string }[]) => {
    const selectedOrgs = allOrgs!.filter((org) =>
      find(newValue, (item) => parseInt(item.value) === org.ORG_ID)
    );
    setSelectedOrgs(selectedOrgs);
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

  const getFetchOrgsFilterQuery = (): Filter<IFlowOrg> => {
    const startPaths = Object.keys(statisticalOrgsByPath);

    return {
      _or: startPaths.map((path) => {
        return {
          T_PATH: {
            _starts_with: path,
          },
        };
      }),
    };
  };

  const getFetchFlowsFilterQuery = (
    orgs: IFlowOrg[] | null
  ): Filter<IFlowStructureH> => {
    const startPaths = Object.keys(statisticalArchitecturesByPath);

    const result: Filter<IFlowStructureH> = {
      _and: [
        {
          _or: startPaths.map((path) => {
            return {
              T_PATH: {
                _starts_with: path,
              },
            };
          }),
        },
        {
          ISFLOW: {
            _eq: 1,
          },
        },
        {
          _and: [
            {
              PUB_TIME: {
                _gte: new Date(timeRange.startTime),
              },
            },
            {
              PUB_TIME: {
                _lte: new Date(timeRange.endTime),
              },
            },
          ],
        },
      ],
    };

    // 责任部门
    if (!isNull(orgs)) {
      result._and.unshift({
        ORG_ID: {
          _in: orgs.map((org) => org.ORG_ID),
        },
      });
    }

    // 版本类型
    if (isNumber(releaseStatus)) {
      result._and.unshift({
        release_status: {
          _eq: releaseStatus,
        },
      });
    }

    // 保密级别
    if (isNumber(confidentialityLevel)) {
      result._and.unshift({
        CONFIDENTIALITY_LEVEL: {
          _eq: confidentialityLevel,
        },
      });
    }

    return result;
  };

  const getFetchRelatedOrgsFilterQuery = (
    orgIds: IFlowOrg["ORG_ID"][]
  ): Filter<IFlowOrg> => {
    const result: Filter<IFlowOrg> = {};
    if (!isEmpty(orgIds)) {
      result["ORG_ID"] = {
        _in: orgIds,
      };
    }

    return result;
  };

  const handleSearch = async () => {
    const directus = directusRef.current;
    if (directus && isLoginSuccess) {
      const FlowStructureH = directus.items("jecn_flow_structure_h");
      const FlowOrg = directus.items("jecn_flow_org");

      if (isEmpty(selectedOrgs)) {
        const flowsResponse = await FlowStructureH.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
          filter: getFetchFlowsFilterQuery(null),
        });
        const searchedFlows = flowsResponse.data as (IFlowStructureH & {
          org?: IFlowOrg;
        })[];
        const relatedOrgIds = uniq(
          searchedFlows?.map((item) => item.ORG_ID)
        ).filter((item) => item !== null) as number[];
        const orgsResponse = await FlowOrg.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
          filter: getFetchRelatedOrgsFilterQuery(relatedOrgIds),
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
        const searchedOrgs = orgsResponse.data as IFlowOrg[];
        const flowsResponse = await FlowStructureH.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
          filter: getFetchFlowsFilterQuery(searchedOrgs),
        });
        const searchedFlows = flowsResponse.data as (IFlowStructureH & {
          org?: IFlowOrg;
        })[];
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
    console.log("flowColumnData", flowColumnData);
    console.log("column2Data", column2Data);
    console.log("flowPubDetails", flowPubDetails);
    console.log("orgPubDetails", orgPubDetails);
  };

  const statisticalArchitecturesByPath = useMemo(() => {
    if (isNull(allFlows)) {
      return {};
    }

    const result: IKeyValue<IFlowStructure> = {};
    const statisticalArchitectures = isEmpty(selectedArchitectures)
      ? allFlows.filter(
          (flow) =>
            flow.PRE_FLOW_ID === ROOT_NODE_ID &&
            flow.ISFLOW === FlowType.architecture
        )
      : selectedArchitectures;
    for (let i = 0, length = statisticalArchitectures.length; i < length; i++) {
      const { T_PATH } = statisticalArchitectures[i];
      result[T_PATH] = statisticalArchitectures[i];
    }

    return result;
  }, [allFlows, selectedArchitectures]);

  const statisticalOrgsByPath = useMemo(() => {
    if (isNull(allOrgs)) {
      return {};
    }

    const result: IKeyValue<IFlowOrg> = {};
    const statisticalOrgs = isEmpty(selectedOrgs)
      ? allOrgs.filter((item) => item.PER_ORG_ID === ROOT_NODE_ID)
      : selectedOrgs;
    for (let i = 0, length = statisticalOrgs.length; i < length; i++) {
      const { T_PATH } = statisticalOrgs[i];
      result[T_PATH] = statisticalOrgs[i];
    }

    return result;
  }, [allOrgs, selectedOrgs]);

  const pubTimeLabelList = useMemo(() => {
    let startTime = dayjs(timeRange.startTime);
    const endTime = dayjs(timeRange.endTime);
    const timeList: string[] = [timeRange.startTime];
    while (startTime.isBefore(endTime)) {
      startTime = startTime.add(1, "month");
      if (startTime.isBefore(endTime)) {
        timeList.push(startTime.toISOString());
      }
    }

    return timeList.map((item) => getPubTimeLabel(item));
  }, [timeRange]);

  const getFlowsByPubTime = () => {
    const result: IKeyValue<IFlowStructureH[]> = {};
    for (let i = 0, length = pubTimeLabelList.length; i < length; i++) {
      result[pubTimeLabelList[i]] = [];
    }

    return result;
  };

  const flowColumnData = useMemo(() => {
    if (!searchedFlows) {
      return [];
    }

    const statisticalFlows = map(
      statisticalArchitecturesByPath,
      (item, path) => {
        const { FLOW_ID, FLOW_NAME } = item;
        return {
          flowId: FLOW_ID,
          flowName: FLOW_NAME,
          flowsByPubTime: getFlowsByPubTime(),
          path: path,
        } as {
          flowId: number;
          flowName: string;
          flowsByPubTime: IKeyValue<IFlowStructureH[]>;
          path: string;
        };
      }
    );
    for (let i = 0, length = searchedFlows.length; i < length; i++) {
      const flow = searchedFlows[i];
      for (let j = 0, length = statisticalFlows.length; j < length; j++) {
        if (flow.T_PATH.startsWith(statisticalFlows[j].path)) {
          const pubTimeLabel = getPubTimeLabel(flow.PUB_TIME);
          const flowsByPubTime = statisticalFlows[j]["flowsByPubTime"];
          if (!flowsByPubTime[pubTimeLabel]) {
            flowsByPubTime[pubTimeLabel] = [];
          }
          flowsByPubTime[pubTimeLabel].push(flow);
        }
      }
    }

    const result: IFlowColumn[] = [];
    for (let i = 0, length = statisticalFlows.length; i < length; i++) {
      const item = statisticalFlows[i];
      const { flowId, flowName, flowsByPubTime } = item;
      forEach(flowsByPubTime, (flows, pubTimeLabel) => {
        if (isEmpty(flows)) {
          result.push({
            flowId,
            flowName,
            pubTimeLabel,
            addCount: 0,
            reviseCount: 0,
            abolishCount: 0,
            totalCount: 0,
          });
        } else {
          let addCount = 0,
            reviseCount = 0,
            abolishCount = 0;
          for (let j = 0, length = flows.length; j < length; j++) {
            const flow = flows[j];
            if (flow.release_status === ReleaseStatus.add) {
              addCount++;
            }

            if (flow.release_status === ReleaseStatus.revise) {
              reviseCount++;
            }

            if (flow.release_status === ReleaseStatus.abolish) {
              abolishCount++;
            }
          }
          result.push({
            flowId,
            flowName,
            pubTimeLabel,
            addCount,
            reviseCount,
            abolishCount,
            totalCount: flows.length,
          });
        }
      });
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
        flowsByPubTime: getFlowsByPubTime(),
        path: path,
      } as {
        orgId: number;
        orgName: string;
        flowsByPubTime: IKeyValue<IFlowStructureH[]>;
        path: string;
      };
    });
    for (let i = 0, length = searchedFlows.length; i < length; i++) {
      const flow = searchedFlows[i];
      for (let j = 0, length = statisticalOrgs.length; j < length; j++) {
        if (flow.org?.T_PATH.startsWith(statisticalOrgs[j].path)) {
          const pubTimeLabel = getPubTimeLabel(flow.PUB_TIME);
          const flowsByPubTime = statisticalOrgs[j]["flowsByPubTime"];
          if (!flowsByPubTime[pubTimeLabel]) {
            flowsByPubTime[pubTimeLabel] = [];
          }
          flowsByPubTime[pubTimeLabel].push(flow);
        }
      }
    }

    const result: IOrgColumn[] = [];
    for (let i = 0, length = statisticalOrgs.length; i < length; i++) {
      const item = statisticalOrgs[i];
      const { orgId, orgName, flowsByPubTime } = item;
      forEach(flowsByPubTime, (flows, pubTimeLabel) => {
        if (isEmpty(flows)) {
          result.push({
            orgId,
            orgName,
            pubTimeLabel,
            addCount: 0,
            reviseCount: 0,
            abolishCount: 0,
            totalCount: 0,
          });
        } else {
          let addCount = 0,
            reviseCount = 0,
            abolishCount = 0;
          for (let j = 0, length = flows.length; j < length; j++) {
            const flow = flows[j];
            if (flow.release_status === ReleaseStatus.add) {
              addCount++;
            }

            if (flow.release_status === ReleaseStatus.revise) {
              reviseCount++;
            }

            if (flow.release_status === ReleaseStatus.abolish) {
              abolishCount++;
            }
          }
          result.push({
            orgId,
            orgName,
            pubTimeLabel,
            addCount,
            reviseCount,
            abolishCount,
            totalCount: flows.length,
          });
        }
      });
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

  const dualAxesFlowColumnData = useMemo(() => {
    const result = [];

    for (let i = 0, length = flowPubDetails.length; i < length; i++) {
      const item = flowPubDetails[i];
      const {
        addCount,
        reviseCount,
        abolishCount,
        flowId,
        flowName,
        pubTimeLabel,
      } = item;
      result.push({
        flowId,
        flowName,
        pubTimeLabel,
        pubCount: addCount,
        releaseStatusLabel: ReleaseStatusMapLabel[ReleaseStatus.add],
      });

      result.push({
        flowId,
        flowName,
        pubTimeLabel,
        pubCount: reviseCount,
        releaseStatusLabel: ReleaseStatusMapLabel[ReleaseStatus.revise],
      });

      result.push({
        flowId,
        flowName,
        pubTimeLabel,
        pubCount: abolishCount,
        releaseStatusLabel: ReleaseStatusMapLabel[ReleaseStatus.abolish],
      });
    }

    return result;
  }, [flowPubDetails]);

  const dualAxesOrgColumnData = useMemo(() => {
    const result = [];

    for (let i = 0, length = orgPubDetails.length; i < length; i++) {
      const item = orgPubDetails[i];
      const {
        addCount,
        reviseCount,
        abolishCount,
        orgId,
        orgName,
        pubTimeLabel,
      } = item;
      result.push({
        orgId,
        orgName,
        pubTimeLabel,
        pubCount: addCount,
        releaseStatusLabel: ReleaseStatusMapLabel[ReleaseStatus.add],
      });

      result.push({
        orgId,
        orgName,
        pubTimeLabel,
        pubCount: reviseCount,
        releaseStatusLabel: ReleaseStatusMapLabel[ReleaseStatus.revise],
      });

      result.push({
        orgId,
        orgName,
        pubTimeLabel,
        pubCount: abolishCount,
        releaseStatusLabel: ReleaseStatusMapLabel[ReleaseStatus.abolish],
      });
    }

    return result;
  }, [orgPubDetails]);

  const dualAxesLegend: ColumnConfig["legend"] = useMemo(() => {
    return {
      itemName: {
        formatter: (text) => {
          if (text === "totalCount") {
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
          data={flowColumnData}
          isStack={true}
          xField={"flowName"}
          yField={"totalCount"}
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
          data={[dualAxesFlowColumnData, flowPubDetails]}
          xField={"pubTimeLabel"}
          yField={["pubCount", "totalCount"]}
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
          yField={"totalCount"}
          seriesField={"pubTimeLabel"}
          label={{
            position: "middle", // 'top', 'bottom', 'middle'
          }}
          autoFit={true}
          onReady={onColumn2Ready}
          style={{ marginRight: "20px", flex: 1 }}
        />
        <DualAxes
          data={[dualAxesOrgColumnData, orgPubDetails]}
          xField={"pubTimeLabel"}
          yField={["pubCount", "totalCount"]}
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
