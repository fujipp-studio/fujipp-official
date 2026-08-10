package com.fujipp.backend.robux;

import org.springframework.stereotype.Service;
import java.util.UUID;

@Service
class RobuxService {
    private final RobuxRepository repository;
    RobuxService(RobuxRepository repository){this.repository=repository;}
    RobuxResponses.Job begin(RobuxRequests.Begin body){requireActive(body.botId());return repository.begin(body);}
    RobuxResponses.Job claim(UUID botId,UUID jobId){requireActive(botId);return repository.claim(botId,jobId).orElseThrow(()->new RobuxException("INVALID_JOB_STATE","รายการถูกประมวลผลไปแล้วหรือไม่อยู่ในสถานะพร้อมจ่าย"));}
    RobuxResponses.Outcome outcome(UUID botId,UUID jobId,RobuxRequests.Outcome body){requireActive(botId);return repository.outcome(botId,jobId,body);}
    RobuxResponses.Refund refund(UUID botId,UUID jobId,RobuxRequests.Failure body){requireActive(botId);return repository.refund(botId,jobId,body);}
    RobuxResponses.Recoverable recoverable(UUID botId){requireActive(botId);return repository.recoverable(botId);}
    private void requireActive(UUID botId){if(!repository.featureActive(botId))throw new RobuxException("FEATURE_NOT_ACTIVE","roblox-robux-payout is not active");}
}
