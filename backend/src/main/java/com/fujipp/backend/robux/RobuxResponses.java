package com.fujipp.backend.robux;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

final class RobuxResponses {
    private RobuxResponses() {}
    record Job(UUID jobId,String memberDiscordId,long robloxUserId,String robloxUsername,
               String groupKey,long groupId,long robuxAmount,long priceSatang,String status,
               long balanceSatang,boolean created,OffsetDateTime createdAt) {}
    record Refund(UUID jobId,long balanceSatang,boolean created,String status) {}
    record Recoverable(List<Job> jobs) {}
    record Outcome(UUID jobId,String status,Map<String,Object> result) {}
}
