import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Spin, Tree, TreeSelect } from "antd";
import { Directus, IAuth, TypeMap } from "@directus/sdk";
import { useAsyncEffect, useMemoizedFn } from "ahooks";
import { arrayToTree } from "@/pages/directus/Example1/helper";
import styled from "styled-components";
import { countBy, filter, find, forEach, isEmpty, map, uniqBy } from "lodash";
import dayjs from "dayjs";
import dynamic from "next/dynamic";
import { ColumnConfig } from "@ant-design/plots/es/components/column";
import { DualAxesConfig } from "@ant-design/plots/es/components/dual-axes";
import { LineConfig } from "@ant-design/plots";

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

const PubTimeMapLabel = {
  1: "1月",
  2: "2月",
  3: "3月",
  4: "4月",
  5: "5月",
  6: "6月",
  7: "7月",
  8: "8月",
  9: "9月",
  10: "10月",
  11: "11月",
  12: "12月",
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
  const [selectedFlowIds, setSelectedFlowIds] = useState<string[]>([]);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [flowItemsByPubTime, setFlowItemsByPubTime] = useState<
    IKeyValue<IFlowStructureH[]>
  >({});
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
    setSelectedFlowIds(newValue.map((item) => item.value));
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

  const handleSearch = async () => {
    const directus = directusRef.current;
    if (directus && isLoginSuccess) {
      const FlowStructure = directus.items("jecn_flow_structure_h");
      const selectedArchitectures = filter(allFlows, (item) =>
        selectedFlowIds.includes(item.FLOW_ID.toString())
      );
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

      const FlowOrg = directus.items("jecn_flow_org");
      const selectedOrgs = filter(allOrgs, (item) =>
        selectedOrgIds.includes(item.ORG_ID.toString())
      );
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
        },
      });

      generateData(result.data || []);
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

  const generateData = (data: IFlowStructureH[]) => {
    const flowItemsByPubTime: IKeyValue<IFlowStructureH[]> = {};
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const pubTime = item.PUB_TIME;
      const month = dayjs(pubTime).month() + 1;
      if (!flowItemsByPubTime[month]) {
        flowItemsByPubTime[month] = [];
      }
      flowItemsByPubTime[month].push(item);
    }
    console.log("selectedFlowIds", selectedFlowIds);
    console.log("selectedOrgIds", selectedOrgIds);
    console.log("flowItemsByPubTime", flowItemsByPubTime);
    setFlowItemsByPubTime(flowItemsByPubTime);
  };

  const column1Data = useMemo(() => {
    const result: {
      pubTime: Date;
      pubTimeMonth: string;
      pubTimeLabel: string;
      flowId: string;
      flowName: string;
      pubCount: number;
      releaseStatus: number;
      releaseStatusLabel: string;
    }[] = [];
    forEach(flowItemsByPubTime, (flows, key) => {
      forEach(countBy(flows, "FLOW_ID"), (count, flowId) => {
        const matchedFlow = find(flows, (item) => item.FLOW_ID == flowId);
        if (matchedFlow) {
          result.push({
            pubTime: matchedFlow.PUB_TIME,
            pubTimeMonth: key,
            pubTimeLabel: PubTimeMapLabel[key],
            flowId: flowId,
            flowName: matchedFlow.FLOW_NAME,
            pubCount: count,
            releaseStatus: matchedFlow.release_status,
            releaseStatusLabel:
              ReleaseStatusMapLabel[matchedFlow.release_status],
          });
        }
      });
    });

    return result;
  }, [flowItemsByPubTime]);

  const column2Data = useMemo(() => {
    const result: {
      pubTime: Date;
      pubTimeMonth: string;
      pubTimeLabel: string;
      orgId: string;
      orgName: string;
      pubCount: number;
      releaseStatus: number;
      releaseStatusLabel: string;
    }[] = [];
    forEach(flowItemsByPubTime, (flows, key) => {
      forEach(countBy(flows, "ORG_ID"), (count, orgId) => {
        const matchedFlow = find(flows, (item) => item.ORG_ID == orgId);
        if (matchedFlow) {
          result.push({
            pubTime: matchedFlow.PUB_TIME,
            pubTimeMonth: key,
            pubTimeLabel: PubTimeMapLabel[key],
            orgId: orgId,
            orgName: matchedFlow.ORG_NAME,
            pubCount: count,
            releaseStatus: matchedFlow.release_status,
            releaseStatusLabel:
              ReleaseStatusMapLabel[matchedFlow.release_status],
          });
        }
      });
    });

    return result;
  }, [flowItemsByPubTime]);

  const onColumn1Ready: ColumnConfig["onReady"] = useMemoizedFn((plot) => {
    plot.on("interval:click", (evt: MouseEvent) => {
      const { x, y } = evt;
      const tooltipData = plot.chart.getTooltipItems({ x, y });
      setFlowPubDetails(tooltipData.map((item) => item.data));
    });
  });

  const onColumn2Ready: ColumnConfig["onReady"] = useMemoizedFn((plot) => {
    plot.on("interval:click", (evt: MouseEvent) => {
      const { x, y } = evt;
      const tooltipData = plot.chart.getTooltipItems({ x, y });
      setOrgPubDetails(tooltipData.map((item) => item.data));
    });
  });

  const dualAxes1LineData = useMemo(() => {
    const result: IKeyValue<IKeyValue[]> = {};
    for (let i = 0; i < flowPubDetails.length; i++) {
      const item = flowPubDetails[i];
      const pubTimeMonth = item.pubTimeMonth;
      if (!result[pubTimeMonth]) {
        result[pubTimeMonth] = [];
      }
      result[pubTimeMonth].push(item);
    }

    const result2: IKeyValue[] = [];
    forEach(result, (item, key) => {
      let count = 0;
      forEach(item, (item) => {
        count += item.pubCount;
      });
      result2.push({
        pubTime: item[0]?.pubTime,
        pubTimeLabel: PubTimeMapLabel[key],
        pubCount: count,
      });
    });

    return result2;
  }, [flowPubDetails]);

  const dualAxes2LineData = useMemo(() => {
    const result: IKeyValue<IKeyValue[]> = {};
    for (let i = 0; i < orgPubDetails.length; i++) {
      const item = orgPubDetails[i];
      const pubTimeMonth = item.pubTimeMonth;
      if (!result[pubTimeMonth]) {
        result[pubTimeMonth] = [];
      }
      result[pubTimeMonth].push(item);
    }

    const result2: IKeyValue[] = [];
    forEach(result, (item, key) => {
      let count = 0;
      forEach(item, (item) => {
        count += item.pubCount;
      });
      result2.push({
        pubTime: item[0]?.pubTime,
        pubTimeLabel: PubTimeMapLabel[key],
        pubCount: count,
      });
    });

    return result2;
  }, [orgPubDetails]);

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
          xField={"flowName"}
          yField={"pubCount"}
          seriesField={"pubTimeLabel"}
          width={800}
          label={{
            position: "middle", // 'top', 'bottom', 'middle'
          }}
          onReady={onColumn1Ready}
          style={{ marginRight: "20px" }}
        />
        <DualAxes
          data={[flowPubDetails, dualAxes1LineData]}
          xField={"pubTimeLabel"}
          yField={["pubCount", "pubCount"]}
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
          width={800}
        />
      </ChartWrapper>
      <ChartWrapper>
        <Column
          data={column2Data}
          isStack={true}
          xField={"orgName"}
          yField={"pubCount"}
          seriesField={"pubTimeLabel"}
          width={800}
          label={{
            position: "middle", // 'top', 'bottom', 'middle'
          }}
          onReady={onColumn2Ready}
          style={{ marginRight: "20px" }}
        />
        <DualAxes
          data={[orgPubDetails, dualAxes2LineData]}
          xField={"pubTimeLabel"}
          yField={["pubCount", "pubCount"]}
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
          width={800}
        />
      </ChartWrapper>
    </Wrapper>
  );
}

export default Example1;
