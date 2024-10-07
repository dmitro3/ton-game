"use client";
import { prismaClient } from "@/db/prisma-client";
import { useUser } from "@/hooks/useUser";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLaunchParams } from "@telegram-apps/sdk-react";
import {
  Card,
  Cell,
  Checkbox,
  Section,
  Title,
  Text,
  Caption,
} from "@telegram-apps/telegram-ui";
import dayjs, { Dayjs } from "dayjs";
import React, { useEffect, useState } from "react";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { COUNT_OF_TASKS } from "../constants";

dayjs.extend(utc);
dayjs.extend(timezone);
const DEBUG = false;

type Task = { toComplete: boolean; Id: number };
const tz = dayjs.tz.guess();

function debugDayjs(day: Dayjs, text?: string) {
  const format = "DD/MM - hh/mm";
  console.log(text, day.tz(tz).format(format));
}

function TaskPage() {
  const userID = useLaunchParams().initData?.user?.id;
  const { user, fetchUser } = useUser();

  const userTasksQuery = useQuery({
    queryFn: () => fetch(`/api/tasks/${userID}`).then((res) => res.json()),
    queryKey: ["tasks", userID],
    placeholderData: [],
    select(data) {
      let items = new Array(COUNT_OF_TASKS)
        .fill({ toComplete: true })
        .map((item, index) => data[index] || item);
      return items;
    },
  });

  const completedAllTasks = userTasksQuery?.data?.every(
    (item) => !item.toComplete
  );

  console.log("all task completed:", completedAllTasks);

  const taskMutation = useMutation({
    mutationFn: (hour: number) =>
      fetch(`/api/tasks/complete`, {
        body: JSON.stringify({ userId: user?.Id, hour }),
        method: "POST",
      }),
  });

  useEffect(() => {
    if (!user || userTasksQuery.isLoading || userTasksQuery.isFetching) return;
    const taskDeadline = dayjs(user?.taskStartTime).add(
      COUNT_OF_TASKS,
      "hours"
    );

    const currentTime = dayjs();

    // if 7hours already passed since taskStartTime
    if (currentTime.isAfter(taskDeadline)) {
      // request to change the taskSTart time to now
      fetch(`/api/tasks/reset`, {
        body: JSON.stringify({
          userId: user?.Id,
          completedAll: completedAllTasks,
        }),
        method: "POST",
      }).then(async () => {
        await fetchUser();
        userTasksQuery.refetch();
      });
    }
  }, [
    user,
    user?.Id,
    user?.taskStartTime,
    userTasksQuery.isLoading,
    userTasksQuery.isFetching,
  ]);

  function shouldTaskBeEnabled(task: Task, index: number) {
    if (!task.toComplete) return false;

    const currentTime = dayjs().tz(tz);

    const currentTaskStartTime = dayjs(user?.taskStartTime).add(index, "hours");
    const currentTaskEndtime = dayjs(user?.taskStartTime).add(
      index + 1,
      "hours"
    );

    return false;
  }

  if (userTasksQuery.isLoading) return "Loading....";

  return (
    <Section>
      <Title
        className="p-5 sticky top-0 z-50 backdrop-blur-xl "
        level="3"
        weight="1"
      >
        Tasks
      </Title>
      <div className="grid grid-cols-2 px-8 pb-8">
        {(userTasksQuery.data || []).map((item: Task, index) => (
          <div key={item.Id} className="p-2">
            <Cell
              Component={"label"}
              before={
                <Checkbox
                  name="check"
                  className="checkbox"
                  onChange={async (e) => {
                    e.target.disabled = true;
                    taskMutation.mutate(index + 1);

                    if (index + 1 == userTasksQuery.data?.length) {
                      console.log(completedAllTasks);
                    }
                  }}
                  defaultChecked={!item.toComplete}
                  disabled={!shouldTaskBeEnabled(item, index)}
                />
              }
              className="rounded-md border border-green-600"
            >
              #{index + 1}
            </Cell>
          </div>
        ))}
      </div>

      <Section.Footer>
        <Caption level="1" weight="2">
          Streaks: {user?.taskStreaks}
        </Caption>
      </Section.Footer>
    </Section>
  );
}

export default TaskPage;
