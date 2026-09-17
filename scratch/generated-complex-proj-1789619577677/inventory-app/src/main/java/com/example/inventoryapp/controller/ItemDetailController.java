package com.example.inventoryapp.controller;

import com.example.inventoryapp.dto.ItemDetailDTO;
import com.example.inventoryapp.service.ItemDetailService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/item-details")
public class ItemDetailController {

    private final ItemDetailService service;

    public ItemDetailController(ItemDetailService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<ItemDetailDTO>> getAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ItemDetailDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<ItemDetailDTO> create(@Valid @RequestBody ItemDetailDTO dto) {
        return new ResponseEntity<>(service.create(dto), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ItemDetailDTO> update(@PathVariable Long id, @Valid @RequestBody ItemDetailDTO dto) {
        return ResponseEntity.ok(service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
