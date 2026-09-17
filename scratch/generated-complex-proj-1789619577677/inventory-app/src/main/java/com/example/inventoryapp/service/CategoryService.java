package com.example.inventoryapp.service;

import com.example.inventoryapp.dto.CategoryDTO;
import com.example.inventoryapp.entity.Category;
import com.example.inventoryapp.mapper.CategoryMapper;
import com.example.inventoryapp.repository.CategoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class CategoryService {

    private final CategoryRepository repository;
    private final CategoryMapper mapper;

    public CategoryService(CategoryRepository repository, CategoryMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<CategoryDTO> findAll() {
        return repository.findAll().stream()
                .map(mapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CategoryDTO findById(Long id) {
        Category entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found with id: " + id));
        return mapper.toDto(entity);
    }

    public CategoryDTO create(CategoryDTO dto) {
        Category entity = mapper.toEntity(dto);
        Category saved = repository.save(entity);
        return mapper.toDto(saved);
    }

    public CategoryDTO update(Long id, CategoryDTO dto) {
        Category existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Category not found with id: " + id));
        mapper.updateEntityFromDto(dto, existing);
        Category saved = repository.save(existing);
        return mapper.toDto(saved);
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("Category not found with id: " + id);
        }
        repository.deleteById(id);
    }
}
