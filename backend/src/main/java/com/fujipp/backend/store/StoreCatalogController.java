package com.fujipp.backend.store;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/store/features")
public class StoreCatalogController {

    private final StoreService storeService;

    public StoreCatalogController(StoreService storeService) {
        this.storeService = storeService;
    }

    @GetMapping
    public List<FeatureSummaryResponse> listFeatures() {
        return storeService.listFeatures();
    }
}
