package com.fujipp.backend.spending;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
@Validated
@RestController @RequestMapping("/internal/v1/member-spending") public class MemberSpendingController {
    private final MemberSpendingService service;
    public MemberSpendingController(MemberSpendingService service){this.service=service;}
    @PostMapping("/add") public MemberSpendingRepository.Entry add(@Valid @RequestBody AddRequest r){return service.add(r.botId(),r.memberDiscordId(),r.deltaSatang());}
    @PutMapping public MemberSpendingRepository.Entry set(@Valid @RequestBody SetRequest r){return service.set(r.botId(),r.memberDiscordId(),r.amountSatang(),r.txCount());}
    @GetMapping public MemberSpendingRepository.Entry get(@RequestParam UUID botId,@RequestParam @Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId){var entry=service.get(botId,memberDiscordId);return entry==null?new MemberSpendingRepository.Entry(memberDiscordId,0,0):entry;}
    @DeleteMapping public boolean remove(@RequestParam UUID botId,@RequestParam @Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId){return service.remove(botId,memberDiscordId);}
    @GetMapping("/leaderboard") public List<MemberSpendingRepository.Entry> leaderboard(@RequestParam UUID botId,@RequestParam(defaultValue="100") int limit){return service.leaderboard(botId,limit);}
    @GetMapping("/totals") public MemberSpendingRepository.Totals totals(@RequestParam UUID botId){return service.totals(botId);}
    public record AddRequest(UUID botId,@Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId,@Min(1) long deltaSatang){}
    public record SetRequest(UUID botId,@Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId,@Min(0) Long amountSatang,@Min(0) Integer txCount){}
}
