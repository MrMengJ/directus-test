import React, { useCallback, useMemo, useRef, useState } from "react";
import { find, forEach, isEmpty, isNull, isNumber, map, uniq } from "lodash";
import { Button, TreeSelect } from "antd";
import styled from "styled-components";
import { Directus, Filter, IAuth } from "@directus/sdk";
import { useAsyncEffect, useMemoizedFn } from "ahooks";
import dayjs from "dayjs";
import dynamic from "next/dynamic";
import { ColumnConfig, PlotEvent } from "@ant-design/plots";

import {
  getPubTimeLabel,
  IFlowOrg,
  IKeyValue,
  IOrgColumn,
  ITimeRange,
  ReleaseStatus,
  ReleaseStatusMapLabel,
  ROOT_NODE_ID,
} from "../Example1/component1";
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

type IRule = {
  ID: number; // 主键
  PER_ID: number;
  RULE_NAME: string;
  SORT_ID: number;
  T_PATH: string;
  IS_DIR: number;
  CONFIDENTIALITY_LEVEL: number | null;
  ORG_ID: number | null;
  ORG_NAME: string | null;
};

type IRuleHistory = IRule & {
  GUID: string; // 主键
  PUB_TIME: string;
  release_status: number;
};

type MyCollections = {
  jecn_flow_org: IFlowOrg;
  jecn_rule_t: IRule;
  jecn_rule_history: IRuleHistory;
};

type IRuleColumn = {
  ruleId: number;
  ruleName: string;
  pubTimeLabel: string;
  addCount: number;
  reviseCount: number;
  abolishCount: number;
  totalCount: number;
};

function Example() {
  const directusRef = useRef<Directus<MyCollections, IAuth>>();
  const [isLoginSuccess, setIsLoginSuccess] = useState(false);
  const [allRules, setAllRules] = useState<IRule[] | null>(null);
  const [allOrgs, setAllOrgs] = useState<IFlowOrg[] | null>(null);
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
  const [selectedRuleDirs, setSelectedRuleDirs] = useState<IRule[]>([]);
  const [selectedOrgs, setSelectedOrgs] = useState<IFlowOrg[]>([]);
  const [searchedRules, setSearchedRules] = useState<
    (IRuleHistory & { org?: IFlowOrg })[] | null
  >(null);
  const [rulePubDetails, setRulePubDetails] = useState<IKeyValue[]>([]);
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

      const RuleStructure = directus.items("jecn_rule_t");
      const OrgStructure = directus.items("jecn_flow_org");

      const [allRules, allOrgs] = [
        await RuleStructure.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
        }),
        await OrgStructure.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
        }),
      ];
      setIsLoginSuccess(true);
      setAllRules(allRules.data || []);
      setAllOrgs(allOrgs.data || []);
    }
  }, []);

  const getRuleTreeData = useCallback(() => {
    const transformedRules = (allRules || []).map((item) => {
      return {
        key: item.ID.toString(),
        value: item.ID.toString(),
        title: item.RULE_NAME,
        parentId: item.PER_ID.toString(),
      };
    });
    return arrayToTree({
      flatData: transformedRules,
      getKey: (item) => {
        return item.key;
      },
      getParentKey: (item) => {
        return item.parentId;
      },
    });
  }, [allRules]);

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

  const handleRuleTreeChange = (newValue: { value: string }[]) => {
    const selectedRuleDirs = allRules!.filter((rule) =>
      find(newValue, (item) => parseInt(item.value) === rule.ID)
    );
    setSelectedRuleDirs(selectedRuleDirs);
  };

  const handleOrgTreeChange = (newValue: { value: string }[]) => {
    const selectedOrgs = allOrgs!.filter((org) =>
      find(newValue, (item) => parseInt(item.value) === org.ORG_ID)
    );
    setSelectedOrgs(selectedOrgs);
  };

  const statisticalRuleDirsByPath = useMemo(() => {
    if (isNull(allRules)) {
      return {};
    }

    const result: IKeyValue<IRule> = {};
    const statisticalRuleDirs = isEmpty(selectedRuleDirs)
      ? allRules.filter((rule) => rule.PER_ID === ROOT_NODE_ID)
      : selectedRuleDirs;
    for (let i = 0, length = statisticalRuleDirs.length; i < length; i++) {
      const { T_PATH } = statisticalRuleDirs[i];
      result[T_PATH] = statisticalRuleDirs[i];
    }

    return result;
  }, [allRules, selectedRuleDirs]);

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

  const getFetchRulesFilterQuery = (
    orgs: IFlowOrg[] | null
  ): Filter<IRuleHistory> => {
    const startPaths = Object.keys(statisticalRuleDirsByPath);

    const result: Filter<IRuleHistory> = {
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
        // {
        //   IS_DIR: {
        //     _eq: 0,
        //   },
        // },
        // {
        //   _and: [
        //     {
        //       PUB_TIME: {
        //         _gte: new Date(timeRange.startTime),
        //       },
        //     },
        //     {
        //       PUB_TIME: {
        //         _lte: new Date(timeRange.endTime),
        //       },
        //     },
        //   ],
        // },
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

  const getRulesByPubTime = () => {
    const result: IKeyValue<IRuleHistory[]> = {};
    for (let i = 0, length = pubTimeLabelList.length; i < length; i++) {
      result[pubTimeLabelList[i]] = [];
    }

    return result;
  };

  const ruleColumnData = useMemo(() => {
    if (!searchedRules) {
      return [];
    }

    const statisticalRuleDirs = map(statisticalRuleDirsByPath, (item, path) => {
      const { ID, RULE_NAME } = item;
      return {
        ruleId: ID,
        ruleName: RULE_NAME,
        rulesByPubTime: getRulesByPubTime(),
        path: path,
      } as {
        ruleId: number;
        ruleName: string;
        rulesByPubTime: IKeyValue<IRuleHistory[]>;
        path: string;
      };
    });

    for (let i = 0, length = searchedRules.length; i < length; i++) {
      const rule = searchedRules[i];
      for (let j = 0, length = statisticalRuleDirs.length; j < length; j++) {
        if (rule.T_PATH.startsWith(statisticalRuleDirs[j].path)) {
          const pubTimeLabel = getPubTimeLabel(rule.PUB_TIME);
          const rulesByPubTime = statisticalRuleDirs[j]["rulesByPubTime"];
          if (!rulesByPubTime[pubTimeLabel]) {
            rulesByPubTime[pubTimeLabel] = [];
          }
          rulesByPubTime[pubTimeLabel].push(rule);
        }
      }
    }

    const result: IRuleColumn[] = [];
    for (let i = 0, length = statisticalRuleDirs.length; i < length; i++) {
      const item = statisticalRuleDirs[i];
      const { ruleId, ruleName, rulesByPubTime } = item;
      forEach(rulesByPubTime, (rules, pubTimeLabel) => {
        if (isEmpty(rules)) {
          result.push({
            ruleId,
            ruleName,
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
          for (let j = 0, length = rules.length; j < length; j++) {
            const rule = rules[j];
            if (rule.release_status === ReleaseStatus.add) {
              addCount++;
            }

            if (rule.release_status === ReleaseStatus.revise) {
              reviseCount++;
            }

            if (rule.release_status === ReleaseStatus.abolish) {
              abolishCount++;
            }
          }
          result.push({
            ruleId,
            ruleName,
            pubTimeLabel,
            addCount,
            reviseCount,
            abolishCount,
            totalCount: rules.length,
          });
        }
      });
    }

    return result;
  }, [searchedRules]);

  const onRuleColumnReady: ColumnConfig["onReady"] = useMemoizedFn((plot) => {
    plot.on("element:click", (evt: PlotEvent) => {
      const { x, y, view } = evt;
      const tooltipData = view.getTooltipItems({ x, y });
      setRulePubDetails(tooltipData.map((item) => item.data));
    });
  });

  const dualAxesRuleColumnData = useMemo(() => {
    const result = [];

    for (let i = 0, length = rulePubDetails.length; i < length; i++) {
      const item = rulePubDetails[i];
      const {
        ruleId,
        ruleName,
        addCount,
        reviseCount,
        abolishCount,
        pubTimeLabel,
      } = item;
      result.push({
        ruleId,
        ruleName,
        pubTimeLabel,
        pubCount: addCount,
        releaseStatusLabel: ReleaseStatusMapLabel[ReleaseStatus.add],
      });

      result.push({
        ruleId,
        ruleName,
        pubTimeLabel,
        pubCount: reviseCount,
        releaseStatusLabel: ReleaseStatusMapLabel[ReleaseStatus.revise],
      });

      result.push({
        ruleId,
        ruleName,
        pubTimeLabel,
        pubCount: abolishCount,
        releaseStatusLabel: ReleaseStatusMapLabel[ReleaseStatus.abolish],
      });
    }

    return result;
  }, [rulePubDetails]);

  const orgColumnData = useMemo(() => {
    if (!searchedRules) {
      return [];
    }

    const statisticalOrgs = map(statisticalOrgsByPath, (item, path) => {
      const { ORG_ID, ORG_NAME } = item;
      return {
        orgId: ORG_ID,
        orgName: ORG_NAME,
        rulesByPubTime: getRulesByPubTime(),
        path: path,
      } as {
        orgId: number;
        orgName: string;
        rulesByPubTime: IKeyValue<IRuleHistory[]>;
        path: string;
      };
    });
    for (let i = 0, length = searchedRules.length; i < length; i++) {
      const flow = searchedRules[i];
      for (let j = 0, length = statisticalOrgs.length; j < length; j++) {
        if (flow.org?.T_PATH.startsWith(statisticalOrgs[j].path)) {
          const pubTimeLabel = getPubTimeLabel(flow.PUB_TIME);
          const rulesByPubTime = statisticalOrgs[j]["rulesByPubTime"];
          if (!rulesByPubTime[pubTimeLabel]) {
            rulesByPubTime[pubTimeLabel] = [];
          }
          rulesByPubTime[pubTimeLabel].push(flow);
        }
      }
    }

    const result: IOrgColumn[] = [];
    for (let i = 0, length = statisticalOrgs.length; i < length; i++) {
      const item = statisticalOrgs[i];
      const { orgId, orgName, rulesByPubTime } = item;
      forEach(rulesByPubTime, (rules, pubTimeLabel) => {
        if (isEmpty(rules)) {
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
          for (let j = 0, length = rules.length; j < length; j++) {
            const rule = rules[j];
            if (rule.release_status === ReleaseStatus.add) {
              addCount++;
            }

            if (rule.release_status === ReleaseStatus.revise) {
              reviseCount++;
            }

            if (rule.release_status === ReleaseStatus.abolish) {
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
            totalCount: rules.length,
          });
        }
      });
    }

    return result;
  }, [searchedRules]);

  const onOrgColumnReady: ColumnConfig["onReady"] = useMemoizedFn((plot) => {
    plot.on("element:click", (evt: PlotEvent) => {
      const { x, y, view } = evt;
      const tooltipData = view.getTooltipItems({ x, y });
      setOrgPubDetails(tooltipData.map((item) => item.data));
    });
  });

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

  const handleSearch = async () => {
    const directus = directusRef.current;
    if (directus && isLoginSuccess) {
      const RuleHistory = directus.items("jecn_rule_history");
      const FlowOrg = directus.items("jecn_flow_org");

      if (isEmpty(selectedOrgs)) {
        const rulesResponse = await RuleHistory.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
          filter: getFetchRulesFilterQuery(null),
        });
        const searchedRules = rulesResponse.data as (IRuleHistory & {
          org?: IFlowOrg;
        })[];
        const relatedOrgIds = uniq(
          searchedRules?.map((item) => item.ORG_ID)
        ).filter((item) => item !== null) as number[];
        const orgsResponse = await FlowOrg.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
          filter: getFetchRelatedOrgsFilterQuery(relatedOrgIds),
        });
        const searchedOrgs = orgsResponse.data as IFlowOrg[];
        for (let i = 0, length = searchedRules.length; i < length; i++) {
          const rule = searchedRules[i];
          for (let j = 0, length = searchedOrgs.length; j < length; j++) {
            const org = searchedOrgs[j];
            if (rule.ORG_ID === org.ORG_ID) {
              rule.org = org;
            }
          }
        }
        setSearchedRules(searchedRules);
      } else {
        const orgsResponse = await FlowOrg.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
          filter: getFetchOrgsFilterQuery(),
        });
        const searchedOrgs = orgsResponse.data as IFlowOrg[];
        const rulesResponse = await RuleHistory.readByQuery({
          limit: -1,
          sort: ["SORT_ID"],
          filter: getFetchRulesFilterQuery(searchedOrgs),
        });
        const searchedRules = rulesResponse.data as (IRuleHistory & {
          org?: IFlowOrg;
        })[];
        for (let i = 0, length = searchedRules.length; i < length; i++) {
          const rule = searchedRules[i];
          for (let j = 0, length = searchedOrgs.length; j < length; j++) {
            const org = searchedOrgs[j];
            if (rule.ORG_ID === org.ORG_ID) {
              rule.org = org;
            }
          }
        }
        setSearchedRules(searchedRules);
      }
    }
  };

  const handleDownload = () => {};

  return (
    <Wrapper>
      <SearchWrapper>
        <Box>
          制度树
          <TreeSelect
            treeData={getRuleTreeData()}
            treeCheckable={true}
            treeCheckStrictly={true}
            style={{ width: "100%" }}
            onChange={handleRuleTreeChange}
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
          data={ruleColumnData}
          isStack={true}
          xField={"ruleName"}
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
          onReady={onRuleColumnReady}
          style={{ marginRight: "20px", flex: 1 }}
        />
        <DualAxes
          data={[dualAxesRuleColumnData, rulePubDetails]}
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
          data={orgColumnData}
          isStack={true}
          xField={"orgName"}
          yField={"totalCount"}
          seriesField={"pubTimeLabel"}
          label={{
            position: "middle", // 'top', 'bottom', 'middle'
          }}
          autoFit={true}
          onReady={onOrgColumnReady}
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

export default Example;
